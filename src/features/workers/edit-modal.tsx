"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { workerEditSchema } from '@/schemas/worker';
import { Input } from '@/components/ui/input';
import { logAction } from '@/lib/audit-logger';

export const WorkerEditModal = ({
  isOpen,
  onClose,
  worker,
}: {
  isOpen?: boolean;
  onClose: () => void;
  worker: {
    id: string;
    name: string;
    email: string;
    full_duty_rate: number;
    half_duty_rate: number;
    is_active: boolean;
    profile_id?: string;
  };
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const { register, handleSubmit, reset, formState: { errors } } = useForm<zod.infer<typeof workerEditSchema>>({
    resolver: zodResolver(workerEditSchema) as any,
    defaultValues: {
      name: worker.name,
      full_duty_rate: worker.full_duty_rate,
      half_duty_rate: worker.half_duty_rate,
      is_active: worker.is_active,
    },
  });

  const onSubmit = async (data: zod.infer<typeof workerEditSchema>) => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      // Optional password reset first (so a failure doesn't leave partial state confusion)
      if (newPassword) {
        if (newPassword.length < 6) {
          throw new Error('New password must be at least 6 characters');
        }
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const res = await fetch(`/api/admin/workers/${worker.id}/password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ password: newPassword }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? 'Failed to reset password');
      }

      const oldValue = JSON.stringify(worker);

      // Persist rates and status on workers (name lives in profiles, not workers)
      const { error } = await supabase
        .from('workers')
        .update({
          full_duty_rate: data.full_duty_rate,
          half_duty_rate: data.half_duty_rate,
          is_active: data.is_active,
        })
        .eq('id', worker.id);

      if (error) throw error;

      // Name lives in profiles — sync it there (required step, surfaced on failure)
      if (worker.profile_id) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ name: data.name })
          .eq('id', worker.profile_id);
        if (profileError) {
          throw new Error(
            `Rates saved, but updating the worker's name failed: ${profileError.message}`
          );
        }
      }

      // Audit: log rate/status/name change
      const ratesChanged =
        data.full_duty_rate !== worker.full_duty_rate || data.half_duty_rate !== worker.half_duty_rate;
      const statusChanged = data.is_active !== worker.is_active;
      const nameChanged = data.name !== worker.name;
      if (ratesChanged || statusChanged || nameChanged || newPassword) {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          await logAction({
            actorUserId: user?.id ?? null,
            action: ratesChanged ? 'CHANGE_RATE' : statusChanged ? 'DEACTIVATE_WORKER' : 'UPDATE_WORKER',
            entityType: 'worker',
            entityId: worker.id,
            oldValue,
            newValue: JSON.stringify({
              name: data.name,
              full_duty_rate: data.full_duty_rate,
              half_duty_rate: data.half_duty_rate,
              is_active: data.is_active,
              password_reset: newPassword ? true : undefined,
            }),
          });
        } catch (_) {}
      }
    } catch (error) {
      console.error('Error updating worker:', error);
      setErrorMsg(error instanceof Error ? error.message : 'Failed to update worker');
      setIsSaving(false);
      return; // keep modal open on error so admin can retry
    } finally {
      setIsSaving(false);
    }
    onClose();
    reset();
    setNewPassword('');
  };

  if (isOpen === false) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xl z-50 flex items-center justify-center p-4" id="edit-modal">
      <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 w-full max-w-md border border-zinc-200 dark:border-zinc-600">
        <h2 className="text-xl font-medium mb-4">Edit Worker</h2>

        <form onSubmit={handleSubmit(onSubmit)}>
          <input type="hidden" name="id" defaultValue={worker.id} />

          <div>
            <label className="block text-sm font-medium mb-2">Name</label>
            <Input
              {...register('name')}
              required
              defaultValue={worker.name}
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2"
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="text"
              value={worker.email}
              readOnly
              disabled
              className="w-full border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-zinc-400">Email cannot be changed.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Full Duty Rate</label>
            <Input
              {...register('full_duty_rate', { valueAsNumber: true })}
              type="number"
              required
              defaultValue={worker.full_duty_rate}
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2"
            />
            {errors.full_duty_rate && <p className="mt-1 text-xs text-red-600">{errors.full_duty_rate.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Half Duty Rate</label>
            <Input
              {...register('half_duty_rate', { valueAsNumber: true })}
              type="number"
              required
              defaultValue={worker.half_duty_rate}
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2"
            />
            {errors.half_duty_rate && <p className="mt-1 text-xs text-red-600">{errors.half_duty_rate.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave blank to keep current password"
              autoComplete="new-password"
              minLength={6}
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2 bg-white dark:bg-zinc-900"
            />
            {newPassword && newPassword.length < 6 && (
              <p className="mt-1 text-xs text-red-600">Must be at least 6 characters.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <label className="flex items-center gap-2">
              <input type="checkbox" {...register('is_active')} defaultChecked={worker.is_active} />
              <span>Active</span>
            </label>
          </div>

          {errorMsg && (
            <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="mt-4 w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {isSaving ? 'Updating...' : 'Update Worker'}
          </button>
          <button
            type="button"
            onClick={() => onClose()}
            className="mt-2 w-full rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
};
