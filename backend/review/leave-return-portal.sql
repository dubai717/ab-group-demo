-- REVIEW CANDIDATE ONLY. Not in an automatic migration manifest.
-- Extend HR with an owned return report; never weaken hr_actor_allowed or original work sessions.
BEGIN;
CREATE TABLE ab.hr_leave_portal_sessions(
 digest text PRIMARY KEY CHECK(digest ~ '^[a-f0-9]{64}$'),tenant_id uuid NOT NULL REFERENCES ab.organizations,
 employee_id uuid NOT NULL,user_id uuid NOT NULL,expires_at timestamptz NOT NULL,revoked boolean NOT NULL DEFAULT false,
 FOREIGN KEY(tenant_id,employee_id)REFERENCES ab.hr_employees(tenant_id,id),FOREIGN KEY(tenant_id,user_id)REFERENCES ab.users(tenant_id,id));
ALTER TABLE ab.hr_leave_portal_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON ab.hr_leave_portal_sessions USING(tenant_id=ab.tenant())WITH CHECK(tenant_id=ab.tenant());
-- No direct runtime SELECT/INSERT/UPDATE/DELETE on limited sessions.
CREATE TABLE ab.hr_leave_resume_proofs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES ab.organizations,hold_id uuid NOT NULL,user_id uuid NOT NULL,employee_id uuid NOT NULL,
 expected_user_revision integer NOT NULL CHECK(expected_user_revision>0),kind text NOT NULL CHECK(kind IN('ActiveBeforeLeave','ContinuousLeave')),parent_id uuid,captured_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,hold_id),FOREIGN KEY(tenant_id,hold_id)REFERENCES ab.hr_account_holds(tenant_id,id),FOREIGN KEY(tenant_id,user_id)REFERENCES ab.users(tenant_id,id),FOREIGN KEY(tenant_id,employee_id)REFERENCES ab.hr_employees(tenant_id,id),FOREIGN KEY(tenant_id,parent_id)REFERENCES ab.hr_leave_resume_proofs(tenant_id,id),
 CHECK((kind='ActiveBeforeLeave'AND parent_id IS NULL)OR(kind='ContinuousLeave'AND parent_id IS NOT NULL)));
ALTER TABLE ab.hr_leave_resume_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON ab.hr_leave_resume_proofs USING(tenant_id=ab.tenant())WITH CHECK(tenant_id=ab.tenant());
CREATE POLICY active_work_actor ON ab.hr_leave_resume_proofs AS RESTRICTIVE USING(ab.hr_actor_allowed())WITH CHECK(ab.hr_actor_allowed());
GRANT SELECT ON ab.hr_leave_resume_proofs TO ab_runtime;
CREATE TRIGGER leave_resume_proof_immutable BEFORE UPDATE OR DELETE ON ab.hr_leave_resume_proofs FOR EACH ROW EXECUTE FUNCTION ab.vehicle_immutable();
CREATE FUNCTION ab.hr_enforce_auth_with_evidence(subject uuid)RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
DECLARE before_user ab.users;after_user ab.users;old_holds uuid[];parent uuid;BEGIN
 SELECT * INTO before_user FROM ab.users WHERE auth_id=subject FOR UPDATE;IF before_user.id IS NULL OR before_user.role_id='owner'THEN RETURN;END IF;
 SELECT coalesce(array_agg(id),'{}'::uuid[])INTO old_holds FROM ab.hr_account_holds WHERE user_id=before_user.id AND tenant_id=before_user.tenant_id;
 IF before_user.status='Pending'THEN SELECT p.id INTO parent FROM ab.hr_leave_resume_proofs p JOIN ab.hr_account_holds h ON h.id=p.hold_id AND h.tenant_id=p.tenant_id
 WHERE p.tenant_id=before_user.tenant_id AND p.user_id=before_user.id AND p.expected_user_revision=before_user.revision AND h.resolved_at IS NULL AND h.reason='leave'ORDER BY p.captured_at,p.id LIMIT 1;END IF;
 PERFORM ab.hr_enforce_auth(subject);SELECT * INTO after_user FROM ab.users WHERE id=before_user.id;
 IF after_user.status='Pending'AND(before_user.status='Active'OR parent IS NOT NULL)THEN
 INSERT INTO ab.hr_leave_resume_proofs(tenant_id,hold_id,user_id,employee_id,expected_user_revision,kind,parent_id)
 SELECT h.tenant_id,h.id,h.user_id,h.employee_id,after_user.revision,CASE WHEN before_user.status='Active'THEN 'ActiveBeforeLeave'ELSE 'ContinuousLeave'END,CASE WHEN before_user.status='Active'THEN NULL ELSE parent END
 FROM ab.hr_account_holds h WHERE h.tenant_id=after_user.tenant_id AND h.user_id=after_user.id AND h.reason='leave'AND h.resolved_at IS NULL AND NOT(h.id=ANY(old_holds))
 ON CONFLICT(tenant_id,hold_id)DO NOTHING;
 END IF;
END $$;
CREATE FUNCTION ab.hr_enforce_session_with_evidence(hash text)RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$DECLARE subject uuid;BEGIN
 SELECT u.auth_id INTO subject FROM ab.sessions s JOIN ab.users u ON u.id=s.user_id AND u.tenant_id=s.tenant_id WHERE s.id_hash=hash;IF subject IS NOT NULL THEN PERFORM ab.hr_enforce_auth_with_evidence(subject);END IF;
END $$;
CREATE TABLE ab.hr_leave_return_requests(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,company_id uuid NOT NULL,employee_id uuid NOT NULL,leave_id uuid NOT NULL,
 reviewer_id uuid NOT NULL,state text NOT NULL DEFAULT 'Reported' CHECK(state IN('Reported','ReturnedForInfo','Rejected','Confirmed')),
 returned_on date NOT NULL,payload_cipher text NOT NULL,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),submitted_by uuid NOT NULL,
 submitted_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,leave_id),FOREIGN KEY(tenant_id,company_id)REFERENCES ab.companies(tenant_id,id),
 FOREIGN KEY(tenant_id,employee_id)REFERENCES ab.hr_employees(tenant_id,id),FOREIGN KEY(tenant_id,leave_id)REFERENCES ab.hr_leaves(tenant_id,id),
 FOREIGN KEY(tenant_id,reviewer_id)REFERENCES ab.users(tenant_id,id),FOREIGN KEY(tenant_id,submitted_by)REFERENCES ab.users(tenant_id,id));
CREATE INDEX leave_return_employee ON ab.hr_leave_return_requests(tenant_id,employee_id,submitted_at);
CREATE INDEX leave_return_reviewer ON ab.hr_leave_return_requests(tenant_id,reviewer_id,state,submitted_at);
CREATE INDEX leave_return_decision_actor ON ab.hr_audit_events(tenant_id,actor_id,created_at)WHERE kind='leave_return_decision';
ALTER TABLE ab.hr_leave_return_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON ab.hr_leave_return_requests USING(tenant_id=ab.tenant())WITH CHECK(tenant_id=ab.tenant());
CREATE POLICY active_work_actor ON ab.hr_leave_return_requests AS RESTRICTIVE USING(ab.hr_actor_allowed())WITH CHECK(ab.hr_actor_allowed());
GRANT SELECT,UPDATE ON ab.hr_leave_return_requests TO ab_runtime;
CREATE FUNCTION ab.guard_leave_return_source()RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,ab AS $$BEGIN
 IF ROW(NEW.id,NEW.tenant_id,NEW.company_id,NEW.employee_id,NEW.leave_id,NEW.submitted_by,NEW.submitted_at)IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.company_id,OLD.employee_id,OLD.leave_id,OLD.submitted_by,OLD.submitted_at)
 OR NEW.revision<>OLD.revision+1 OR NOT((OLD.state IN('ReturnedForInfo','Rejected')AND NEW.state='Reported')OR(OLD.state='Reported'AND NEW.state IN('ReturnedForInfo','Rejected','Confirmed')))
 THEN RAISE EXCEPTION 'leaveReturnSourceImmutable' USING ERRCODE='23514';END IF;RETURN NEW;END $$;
REVOKE ALL ON FUNCTION ab.guard_leave_return_source()FROM PUBLIC;
CREATE TRIGGER leave_return_source_immutable BEFORE UPDATE ON ab.hr_leave_return_requests FOR EACH ROW EXECUTE FUNCTION ab.guard_leave_return_source();
CREATE FUNCTION ab.hr_return_principal(subject uuid)RETURNS TABLE(id uuid,tenant_id uuid,employee_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
 SELECT u.id,u.tenant_id,e.id FROM ab.users u JOIN ab.hr_employees e ON e.user_id=u.id AND e.tenant_id=u.tenant_id
 WHERE u.auth_id=subject AND u.status='Pending'AND u.role_id<>'owner'AND e.state IN('Active','OnLeave')
 AND EXISTS(SELECT 1 FROM ab.hr_account_holds h JOIN ab.hr_leaves l ON l.employee_id=h.employee_id AND l.tenant_id=h.tenant_id AND h.source_key='leave:'||l.id::text
 WHERE h.tenant_id=u.tenant_id AND h.user_id=u.id AND h.employee_id=e.id AND h.reason='leave'AND h.resolved_at IS NULL AND l.state='Approved'AND l.suspend_account AND l.suspended_at IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM ab.hr_account_holds h WHERE h.tenant_id=u.tenant_id AND h.user_id=u.id AND h.resolved_at IS NULL AND h.reason<>'leave')
 AND NOT EXISTS(SELECT 1 FROM ab.hr_terminations t WHERE t.tenant_id=e.tenant_id AND t.employee_id=e.id AND t.state IN('Approved','Settled')AND t.last_on<timezone('Asia/Dubai',now())::date)
$$;
CREATE FUNCTION ab.hr_return_login_identity(name text)RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
 SELECT u.auth_email FROM ab.users u JOIN LATERAL ab.hr_return_principal(u.auth_id)p ON p.id=u.id AND p.tenant_id=u.tenant_id WHERE u.normalized_username=lower(btrim(name))
$$;
CREATE FUNCTION ab.hr_return_actor(subject uuid)RETURNS TABLE(id uuid,tenant_id uuid,employee_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$DECLARE p record;BEGIN
 SELECT * INTO p FROM ab.hr_return_principal(subject);
 IF p.id IS NULL OR p.id IS DISTINCT FROM nullif(current_setting('ab.actor',true),'')::uuid OR p.tenant_id IS DISTINCT FROM ab.tenant()THEN RAISE EXCEPTION 'leaveReturnActorRequired' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT p.id,p.tenant_id,p.employee_id;
END $$;
CREATE FUNCTION ab.hr_return_context(subject uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
DECLARE p record;e ab.hr_employees;u ab.users;st jsonb;manual jsonb;ls jsonb;BEGIN
 SELECT * INTO p FROM ab.hr_return_actor(subject);PERFORM ab.hr_enforce_auth_with_evidence(subject);SELECT * INTO p FROM ab.hr_return_actor(subject);
 SELECT * INTO e FROM ab.hr_employees WHERE id=p.employee_id AND tenant_id=p.tenant_id;SELECT * INTO u FROM ab.users WHERE id=p.id AND tenant_id=p.tenant_id;
 SELECT value INTO st FROM ab.settings WHERE tenant_id=p.tenant_id AND key='managed-test-users-state-v1';SELECT value->p.id::text INTO manual FROM ab.settings WHERE tenant_id=p.tenant_id AND key='manual-test-passwords-v1';
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',l.id,'startsOn',l.starts_on,'endsOn',l.ends_on,'leaveRevision',l.revision,
 'request',CASE WHEN r.id IS NULL THEN NULL ELSE to_jsonb(r)END)ORDER BY l.starts_on DESC,l.id),'[]'::jsonb)INTO ls
 FROM ab.hr_leaves l JOIN ab.hr_account_holds h ON h.tenant_id=l.tenant_id AND h.employee_id=l.employee_id AND h.source_key='leave:'||l.id::text
 LEFT JOIN ab.hr_leave_return_requests r ON r.tenant_id=l.tenant_id AND r.leave_id=l.id
 WHERE l.tenant_id=p.tenant_id AND l.employee_id=p.employee_id AND l.state='Approved'AND h.user_id=p.id AND h.reason='leave'AND h.resolved_at IS NULL;
 IF jsonb_array_length(ls)>100 THEN RAISE EXCEPTION 'leaveReturnRangeRequired' USING ERRCODE='22023';END IF;
 RETURN jsonb_build_object('employee',jsonb_build_object('id',e.id,'company_id',e.company_id,'user_id',e.user_id,'manager_id',e.manager_id,'payload_cipher',e.payload_cipher),'leaves',ls,
 'testData',jsonb_build_object('ownerCreatedTest',u.data->'ownerCreatedTest','managedTestSuite',u.data->'managedTestSuite','testProject',u.data->'testProject'),
 'testState',CASE WHEN st IS NULL OR st='null'::jsonb THEN NULL ELSE jsonb_build_object('suite',st->'suite','disabled',st->'disabled','passwordExpiresAt',jsonb_build_object(p.id::text,st->'passwordExpiresAt'->p.id::text))END,
 'manual',jsonb_build_object(p.id::text,manual));
END $$;
CREATE FUNCTION ab.hr_return_nonce(subject uuid,hash text,mode text,deadline timestamptz DEFAULT NULL)RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$DECLARE p record;ok boolean;BEGIN
 SELECT * INTO p FROM ab.hr_return_actor(subject);IF hash!~'^[a-f0-9]{64}$'THEN RAISE EXCEPTION 'invalidNonce' USING ERRCODE='22023';END IF;
 IF mode='create'THEN
 IF deadline<=now()OR deadline>now()+interval '15 minutes 5 seconds'OR deadline IS NULL THEN RAISE EXCEPTION 'invalidExpiry' USING ERRCODE='22023';END IF;
 INSERT INTO ab.hr_leave_portal_sessions(digest,tenant_id,employee_id,user_id,expires_at)VALUES(hash,p.tenant_id,p.employee_id,p.id,deadline);
 INSERT INTO ab.audit_events(id,tenant_id,actor_id,action,entity_type,entity_id,fields,request_id)VALUES(gen_random_uuid(),p.tenant_id,p.id,'leave_portal_login','personnel',p.employee_id,ARRAY['limited_return_only','no_work_access'],gen_random_uuid());RETURN true;
 ELSIF mode='check'THEN SELECT EXISTS(SELECT 1 FROM ab.hr_leave_portal_sessions s WHERE s.digest=hash AND s.tenant_id=p.tenant_id AND s.employee_id=p.employee_id AND s.user_id=p.id AND NOT s.revoked AND s.expires_at>now())INTO ok;RETURN ok;
 ELSIF mode='revoke'THEN UPDATE ab.hr_leave_portal_sessions SET revoked=true WHERE digest=hash AND tenant_id=p.tenant_id AND employee_id=p.employee_id AND user_id=p.id AND NOT revoked;RETURN FOUND;
 ELSE RAISE EXCEPTION 'invalidNonceMode' USING ERRCODE='22023';END IF;
END $$;
CREATE FUNCTION ab.hr_return_logout(subject uuid,hash text)RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$DECLARE u ab.users;BEGIN
 SELECT * INTO u FROM ab.users WHERE auth_id=subject;IF u.id IS NULL OR u.id IS DISTINCT FROM nullif(current_setting('ab.actor',true),'')::uuid OR u.tenant_id IS DISTINCT FROM ab.tenant()OR hash!~'^[a-f0-9]{64}$'THEN RAISE EXCEPTION 'leaveReturnActorRequired' USING ERRCODE='42501';END IF;
 UPDATE ab.hr_leave_portal_sessions SET revoked=true WHERE digest=hash AND tenant_id=u.tenant_id AND user_id=u.id AND NOT revoked;
END $$;
CREATE FUNCTION ab.hr_report_return(subject uuid,leave_key uuid,report_key uuid,returned date,note_cipher text,audit_cipher text,expected_revision integer)RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$DECLARE p record;e ab.hr_employees;l ab.hr_leaves;r ab.hr_leave_return_requests;reviewer uuid;BEGIN
 SELECT * INTO p FROM ab.hr_return_actor(subject);PERFORM pg_advisory_xact_lock(hashtextextended('leave-return:'||leave_key::text,0));
 SELECT * INTO e FROM ab.hr_employees WHERE id=p.employee_id AND tenant_id=p.tenant_id;
 SELECT x.* INTO l FROM ab.hr_leaves x WHERE x.id=leave_key AND x.tenant_id=p.tenant_id AND x.employee_id=p.employee_id AND x.state='Approved'AND x.suspend_account
 AND EXISTS(SELECT 1 FROM ab.hr_account_holds h WHERE h.tenant_id=p.tenant_id AND h.employee_id=p.employee_id AND h.user_id=p.id AND h.source_key='leave:'||x.id::text AND h.reason='leave'AND h.resolved_at IS NULL)FOR UPDATE;
 IF l.id IS NULL THEN RAISE EXCEPTION 'leaveReturnScopeDenied' USING ERRCODE='42501';END IF;
 IF returned<l.starts_on OR returned>timezone('Asia/Dubai',now())::date OR returned IS NULL OR expected_revision<0 OR length(note_cipher)NOT BETWEEN 32 AND 16384 OR length(audit_cipher)NOT BETWEEN 32 AND 32768 THEN RAISE EXCEPTION 'invalidReturnReport' USING ERRCODE='22023';END IF;
 SELECT * INTO r FROM ab.hr_leave_return_requests WHERE tenant_id=p.tenant_id AND leave_id=l.id FOR UPDATE;
 IF coalesce(r.revision,0)<>expected_revision OR(r.id IS NOT NULL AND(r.state NOT IN('ReturnedForInfo','Rejected')OR r.id<>report_key))THEN RAISE EXCEPTION 'returnRevisionConflict' USING ERRCODE='40001';END IF;
 SELECT x.id INTO reviewer FROM ab.users x WHERE x.tenant_id=p.tenant_id AND x.status='Active'AND(x.id=e.manager_id OR x.role_id='owner')ORDER BY CASE WHEN x.id=e.manager_id THEN 0 ELSE 1 END,x.id LIMIT 1;
 IF reviewer IS NULL THEN RAISE EXCEPTION 'leaveReturnReviewerRequired' USING ERRCODE='23514';END IF;
 IF r.id IS NULL THEN INSERT INTO ab.hr_leave_return_requests(id,tenant_id,company_id,employee_id,leave_id,reviewer_id,returned_on,payload_cipher,submitted_by)VALUES(report_key,p.tenant_id,e.company_id,e.id,l.id,reviewer,returned,note_cipher,p.id)RETURNING * INTO r;
 ELSE UPDATE ab.hr_leave_return_requests SET state='Reported',reviewer_id=reviewer,returned_on=returned,payload_cipher=note_cipher,revision=revision+1,updated_at=now()WHERE id=r.id RETURNING * INTO r;END IF;
 INSERT INTO ab.hr_audit_events(id,tenant_id,company_id,employee_id,actor_id,kind,payload_cipher)VALUES(gen_random_uuid(),p.tenant_id,e.company_id,e.id,p.id,'leave_return_reported',audit_cipher);
 INSERT INTO ab.finance_notifications(id,tenant_id,company_id,user_id,action,event_key,entity_id)VALUES(gen_random_uuid(),p.tenant_id,e.company_id,reviewer,'personnel:leave_return_review','leave-return:'||r.id::text||':'||r.revision::text,l.id)ON CONFLICT(tenant_id,user_id,event_key)DO NOTHING;
 RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION ab.hr_enforce_auth_with_evidence(uuid),ab.hr_enforce_session_with_evidence(text),ab.hr_return_logout(uuid,text),ab.hr_return_actor(uuid),ab.hr_return_principal(uuid),ab.hr_return_login_identity(text),ab.hr_return_context(uuid),ab.hr_return_nonce(uuid,text,text,timestamptz),ab.hr_report_return(uuid,uuid,uuid,date,text,text,integer)FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.hr_enforce_auth_with_evidence(uuid),ab.hr_enforce_session_with_evidence(text),ab.hr_return_logout(uuid,text),ab.hr_return_principal(uuid),ab.hr_return_login_identity(text),ab.hr_return_context(uuid),ab.hr_return_nonce(uuid,text,text,timestamptz),ab.hr_report_return(uuid,uuid,uuid,date,text,text,integer)TO ab_runtime;
COMMIT;
