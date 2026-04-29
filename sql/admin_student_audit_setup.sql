USE placement_hw;

CREATE TABLE IF NOT EXISTS LOGIN_AUDIT (
    audit_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    login_success TINYINT(1) NOT NULL,
    login_time_utc DATETIME NOT NULL DEFAULT UTC_TIMESTAMP(),
    ip_address VARCHAR(64),
    user_agent VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES USERS(user_id)
);

CREATE OR REPLACE VIEW VW_LOGIN_AUDIT_IST AS
SELECT
    la.audit_id,
    la.user_id,
    u.email AS username,
    u.role AS user_type,
    la.login_success,
    CONVERT_TZ(la.login_time_utc, '+00:00', '+05:30') AS login_time_ist,
    DATE(CONVERT_TZ(la.login_time_utc, '+00:00', '+05:30')) AS login_date_ist,
    la.ip_address
FROM LOGIN_AUDIT la
JOIN USERS u ON u.user_id = la.user_id
ORDER BY la.audit_id DESC;

DELIMITER $$
DROP TRIGGER IF EXISTS TRG_LOGIN_AUDIT_NO_UPDATE $$
CREATE TRIGGER TRG_LOGIN_AUDIT_NO_UPDATE
BEFORE UPDATE ON LOGIN_AUDIT
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'LOGIN_AUDIT is immutable (update blocked)';
END $$

DROP TRIGGER IF EXISTS TRG_LOGIN_AUDIT_NO_DELETE $$
CREATE TRIGGER TRG_LOGIN_AUDIT_NO_DELETE
BEFORE DELETE ON LOGIN_AUDIT
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'LOGIN_AUDIT is immutable (delete blocked)';
END $$
DELIMITER ;

-- Optional demo audit rows
INSERT INTO LOGIN_AUDIT (user_id, login_success, login_time_utc, ip_address, user_agent)
SELECT user_id, 1, UTC_TIMESTAMP(), '127.0.0.1', 'demo-script'
FROM USERS
WHERE email IN ('admin.demo@hw.uk', 'student.demo@hw.uk');
