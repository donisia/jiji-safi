-- (v2: keeps the existing module, never deletes) Run this on its own. Recreates the bot endpoint: POST /whatsapp/report
-- ---------- 2. REST: the bot posts here --------------------------------------
DECLARE n NUMBER;
BEGIN
  SELECT COUNT(*) INTO n FROM user_ords_modules WHERE name = 'whatsapp';
  IF n = 0 THEN
    ORDS.DEFINE_MODULE(p_module_name => 'whatsapp', p_base_path => '/whatsapp/',
                     p_items_per_page => 25, p_status => 'PUBLISHED');
  END IF;
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

