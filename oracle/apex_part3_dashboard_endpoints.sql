-- Run this on its own, AFTER part 2. Creates the dashboard endpoints under /jiji/
BEGIN
  ORDS.DELETE_MODULE(p_module_name => 'jiji');
  COMMIT;
EXCEPTION WHEN OTHERS THEN NULL;   -- module did not exist, fine
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

