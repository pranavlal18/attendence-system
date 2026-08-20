-- ============================================================
-- Worker Policies
-- ============================================================

-- Workers can SELECT their own profile
CREATE POLICY "Workers can view own profile" ON profiles
FOR SELECT USING (auth.uid() = user_id);

-- Workers can SELECT their own duty records
CREATE POLICY "Workers can view own duty records" ON duty_records
FOR SELECT USING (worker_id IN (
  SELECT id FROM workers WHERE profile_id = auth.uid()
));

-- Workers can INSERT their own duty records
CREATE POLICY "Workers can insert own duty records" ON duty_records
FOR INSERT WITH CHECK (worker_id IN (
  SELECT id FROM workers WHERE profile_id = auth.uid()
));

-- ============================================================
-- Admin Policies
-- ============================================================

-- Admins can CRUD profiles (including role management)
CREATE POLICY "Admins can manage profiles" ON profiles
USING (true) WITH CHECK (true);

-- Admins can CRUD workers
CREATE POLICY "Admins can manage workers" ON workers
USING (true) WITH CHECK (true);

-- Admins can deactivate workers (soft delete)
CREATE POLICY "Admins can deactivate workers" ON workers
USING (true) WITH CHECK (is_active = true);

-- Admins can SELECT all duty records
CREATE POLICY "Admins can view all duty records" ON duty_records
FOR SELECT USING (true);

-- Admins can INSERT duty records
CREATE POLICY "Admins can insert duty records" ON duty_records
FOR INSERT WITH CHECK (true);

-- Admins can UPDATE duty records
CREATE POLICY "Admins can update duty records" ON duty_records
USING (true) WITH CHECK (true);

-- Admins can DELETE duty records
CREATE POLICY "Admins can delete duty records" ON duty_records
FOR DELETE USING (true);

-- Admins can SELECT all audit logs
CREATE POLICY "Admins can view audit logs" ON audit_logs
FOR SELECT USING (true);