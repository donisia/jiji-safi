-- =============================================================================
-- Jiji Safi - Oracle APEX setup  (run in SQL Workshop > SQL Scripts, then Run)
-- Safe to run more than once.
--
-- Creates / updates:
--   tables   REPORTS, CREDITS
--   REST     POST /whatsapp/report      <- the bot (APEX_URL in the bot's .env)
--            GET  /jiji/reports         <- dashboard
--            PUT  /jiji/reports/:id     <- dashboard "collected / flagged" buttons
--            GET  /jiji/credits         <- dashboard
--            POST /jiji/credits         <- dashboard "issue credit"
-- =============================================================================

-- ---------- 1. Tables (skipped if they already exist) ------------------------
BEGIN
  EXECUTE IMMEDIATE q'[
    CREATE TABLE reports (
      id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      ts            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      source        VARCHAR2(30),
      reporter_id   VARCHAR2(50),
      reporter_name VARCHAR2(100),
      zone          VARCHAR2(100),
      lat           NUMBER(10,6),
      lon           NUMBER(10,6),
      waste_type    VARCHAR2(50),
      volume        VARCHAR2(50),
      details       VARCHAR2(4000),
      photo_url     VARCHAR2(2000),
      drain_blocked NUMBER(1) DEFAULT 0,
      status        VARCHAR2(20) DEFAULT 'open',
      co2e_kg       NUMBER(10,2),
      message_id    VARCHAR2(200)
    )]';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;  -- already exists
END;
/
-- If REPORTS already existed from the old README, add what the bot needs
BEGIN EXECUTE IMMEDIATE 'ALTER TABLE reports ADD (message_id VARCHAR2(200))';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -1430 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE 'ALTER TABLE reports MODIFY (photo_url VARCHAR2(2000))';
EXCEPTION WHEN OTHERS THEN NULL; END;
/
-- WhatsApp retries webhooks; this stops the same message being saved twice
BEGIN EXECUTE IMMEDIATE 'CREATE UNIQUE INDEX reports_msgid_uq ON reports (message_id)';
EXCEPTION WHEN OTHERS THEN IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF; END;
/
BEGIN
  EXECUTE IMMEDIATE q'[
    CREATE TABLE credits (
      id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      ts            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      reporter_id   VARCHAR2(50),
      reporter_name VARCHAR2(100),
      zone          VARCHAR2(100),
      amount        NUMBER,
      reason        VARCHAR2(255)
    )]';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

-- ---------- 2. REST: the bot posts here --------------------------------------
BEGIN
  ORDS.DEFINE_MODULE(p_module_name => 'whatsapp', p_base_path => '/whatsapp/',
                     p_items_per_page => 25, p_status => 'PUBLISHED');
  ORDS.DEFINE_TEMPLATE(p_module_name => 'whatsapp', p_pattern => 'report');

  ORDS.DEFINE_HANDLER(
    p_module_name => 'whatsapp', p_pattern => 'report', p_method => 'POST',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'[
DECLARE
  l_body    CLOB := :body_text;
  l_msgid   VARCHAR2(200)  := JSON_VALUE(l_body, '$.message_id');
  l_phone   VARCHAR2(50)   := SUBSTR(JSON_VALUE(l_body, '$.phone'), 1, 50);
  l_in_type VARCHAR2(50)   := LOWER(JSON_VALUE(l_body, '$.waste_type'));
  l_zone    VARCHAR2(100)  := SUBSTR(NVL(JSON_VALUE(l_body, '$.zone'), 'Not specified'), 1, 100);
  l_details VARCHAR2(4000) := JSON_VALUE(l_body, '$.details');
  l_photo   VARCHAR2(2000) := JSON_VALUE(l_body, '$.photo_url' RETURNING VARCHAR2(4000));
  l_type    VARCHAR2(50);
  l_volume  VARCHAR2(50)   := 'small bag';   -- bot does not ask volume yet
  l_kg      NUMBER         := 5;
  l_factor  NUMBER;
  l_lat     NUMBER;
  l_lon     NUMBER;
  l_id      NUMBER;
BEGIN
  -- Same message already saved (webhook retry)? Return it, don't duplicate.
  IF l_msgid IS NOT NULL THEN
    BEGIN
      SELECT id INTO l_id FROM reports WHERE message_id = l_msgid;
      :status_code := 200;  :new_id := l_id;  RETURN;
    EXCEPTION WHEN NO_DATA_FOUND THEN NULL;
    END;
  END IF;

  -- Names the dashboard uses (lowercase except Metal / General)
  l_type := CASE l_in_type WHEN 'plastic' THEN 'plastic' WHEN 'organic' THEN 'organic'
                           WHEN 'metal'   THEN 'Metal'   ELSE 'General' END;
  l_factor := CASE l_type WHEN 'plastic' THEN 2.5 WHEN 'organic' THEN 0.8
                          WHEN 'Metal' THEN 0.5 ELSE 1.0 END;

  -- Pin the report near its zone centre (small random offset so pins don't stack)
  SELECT lat, lon INTO l_lat, l_lon FROM (
    SELECT -1.3601 lat, 36.6531 lon FROM dual WHERE UPPER(l_zone) LIKE '%NGONG%'
    UNION ALL SELECT -1.3878, 36.7498 FROM dual WHERE UPPER(l_zone) LIKE '%RONGAI%'
    UNION ALL SELECT -1.4105, 36.6833 FROM dual WHERE UPPER(l_zone) LIKE '%KISERIAN%'
    UNION ALL SELECT -1.3932, 36.6556 FROM dual WHERE UPPER(l_zone) LIKE '%MATASIA%'
    UNION ALL SELECT -1.2769, 36.7428 FROM dual WHERE UPPER(l_zone) LIKE '%KAWANGWARE%'
    UNION ALL SELECT -1.3500, 36.6700 FROM dual WHERE UPPER(l_zone) LIKE '%EMBULBUL%'
    UNION ALL SELECT -1.3167, 36.7167 FROM dual WHERE UPPER(l_zone) LIKE '%KAREN%'
    UNION ALL SELECT -1.3800, 36.7200 FROM dual WHERE UPPER(l_zone) LIKE '%KWARE%'
    UNION ALL SELECT -1.3601, 36.6531 FROM dual          -- fallback: Ngong
  ) WHERE ROWNUM = 1;
  l_lat := l_lat + DBMS_RANDOM.VALUE(-0.004, 0.004);
  l_lon := l_lon + DBMS_RANDOM.VALUE(-0.004, 0.004);

  INSERT INTO reports (source, reporter_id, zone, lat, lon, waste_type, volume,
                       details, photo_url, drain_blocked, status, co2e_kg, message_id)
  VALUES ('whatsapp', l_phone, l_zone, l_lat, l_lon, l_type, l_volume,
          NVL(l_details, '(no details)'), l_photo, 0, 'open',
          ROUND(l_kg * l_factor, 2), l_msgid)
  RETURNING id INTO l_id;

  COMMIT;
  :status_code := 201;
  :new_id := l_id;
END;]');

  ORDS.DEFINE_PARAMETER(p_module_name => 'whatsapp', p_pattern => 'report', p_method => 'POST',
    p_name => 'new_id', p_bind_variable_name => 'new_id',
    p_source_type => 'RESPONSE', p_param_type => 'INT', p_access_method => 'OUT');
  COMMIT;
END;
/

-- ---------- 3. REST: the dashboard reads / updates here ----------------------
BEGIN
  ORDS.DEFINE_MODULE(p_module_name => 'jiji', p_base_path => '/jiji/',
                     p_items_per_page => 1000, p_status => 'PUBLISHED');

  -- GET /jiji/reports  (newest first, up to 1000)
  ORDS.DEFINE_TEMPLATE(p_module_name => 'jiji', p_pattern => 'reports');
  ORDS.DEFINE_HANDLER(p_module_name => 'jiji', p_pattern => 'reports', p_method => 'GET',
    p_source_type => ORDS.source_type_collection_feed, p_items_per_page => 1000,
    p_source => q'[SELECT id, ts, source, reporter_id, reporter_name, zone, lat, lon,
                          waste_type, volume, details, photo_url, drain_blocked, status, co2e_kg
                     FROM reports ORDER BY ts DESC]');

  -- PUT /jiji/reports/:id   body: {"status":"open|collected|flagged"}
  ORDS.DEFINE_TEMPLATE(p_module_name => 'jiji', p_pattern => 'reports/:id');
  ORDS.DEFINE_HANDLER(p_module_name => 'jiji', p_pattern => 'reports/:id', p_method => 'PUT',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'[
DECLARE
  l_status VARCHAR2(20) := LOWER(JSON_VALUE(:body_text, '$.status'));
BEGIN
  IF l_status NOT IN ('open', 'collected', 'flagged') OR l_status IS NULL THEN
    :status_code := 400;  RETURN;
  END IF;
  UPDATE reports SET status = l_status WHERE id = :id;
  IF SQL%ROWCOUNT = 0 THEN :status_code := 404; ELSE COMMIT; :status_code := 200; END IF;
END;]');

  -- GET /jiji/credits
  ORDS.DEFINE_TEMPLATE(p_module_name => 'jiji', p_pattern => 'credits');
  ORDS.DEFINE_HANDLER(p_module_name => 'jiji', p_pattern => 'credits', p_method => 'GET',
    p_source_type => ORDS.source_type_collection_feed, p_items_per_page => 1000,
    p_source => q'[SELECT id, ts, reporter_id, reporter_name, zone, amount, reason
                     FROM credits ORDER BY ts DESC]');

  -- POST /jiji/credits
  ORDS.DEFINE_HANDLER(p_module_name => 'jiji', p_pattern => 'credits', p_method => 'POST',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'[
BEGIN
  INSERT INTO credits (reporter_id, reporter_name, zone, amount, reason)
  VALUES (SUBSTR(JSON_VALUE(:body_text, '$.reporter_id'), 1, 50),
          SUBSTR(JSON_VALUE(:body_text, '$.reporter_name'), 1, 100),
          SUBSTR(JSON_VALUE(:body_text, '$.zone'), 1, 100),
          JSON_VALUE(:body_text, '$.amount' RETURNING NUMBER),
          SUBSTR(JSON_VALUE(:body_text, '$.reason'), 1, 255));
  COMMIT;
  :status_code := 201;
END;]');
  COMMIT;
END;
/

-- ---------- 4. Quick check ----------------------------------------------------
-- After running, SQL Workshop > RESTful Services should list modules "whatsapp"
-- and "jiji". Test from a terminal (replace the base URL with yours):
--   curl -X POST  <BASE>/whatsapp/report -H "Content-Type: application/json" \
--        -d '{"phone":"254700000000","waste_type":"Plastic","zone":"Ngong","details":"test","message_id":"t1"}'
--   curl <BASE>/jiji/reports
