"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { workerSchema } from '@/schemas/worker';
import { Input } from '@/components/ui/input';

export const WorkerCreateModal = ({
  isOpen,
  onClose,
  onCreate,
}: {
  isOpen?: boolean;
  onClose: () => void;
  onCreate?: (data: zod.infer<typeof workerSchema>) => Promise<void> | void;
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<zod.infer<typeof workerSchema>>({
    resolver: zodResolver(workerSchema) as any,
    defaultValues: {
      is_active: true,
    },
  });

  const onSubmit = async (data: zod.infer<typeof workerSchema>) => {
    setIsSaving(true);
    try {
      if (onCreate) {
        await onCreate(data);
      } else {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: crypto.randomUUID(),
            role: 'WORKER',
            name: data.name,
            email: data.email,
            phone: '',
          })
          .select()
          .single();

        if (profileError) throw profileError;

        const profileId = (profileData as any)?.id ?? (profileData as any)?.user_id ?? crypto.randomUUID();

        const { error: workerError } = await supabase
          .from('workers')
          .insert({
            profile_id: profileId,
            full_duty_rate: data.full_duty_rate,
            half_duty_rate: data.half_duty_rate,
            is_active: data.is_active,
          });

        if (workerError) throw workerError;
      }
    } catch (error) {
      console.error('Error creating worker:', error);
    } finally {
      setIsSaving(false);
      onClose();
      reset();
    }
  };

  if (isOpen === false) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xl z-50 flex items-center justify-center" id="create-modal">
      <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 w-full max-w-md border border-zinc-200 dark:border-zinc-600">
        <h2 className="text-xl font-medium mb-4">Create New Worker</h2>
        
        <form onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="block text-sm font-medium mb-2">Name</label>
            <Input
              {...register('name')}
              required
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <Input
              {...register('email')}
              type="email"
              required
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Password <span className="text-zinc-400 font-normal">(worker login)</span></label>
            <Input
              {...register('password')}
              type="password"
              placeholder="Min 6 characters"
              required
              minLength={6}
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Full Duty Rate</label>
            <Input
              {...register('full_duty_rate', { valueAsNumber: true })}
              type="number"
              required
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Half Duty Rate</label>
            <Input
              {...register('half_duty_rate', { valueAsNumber: true })}
              type="number"
              required
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2"
            />
          </div>
          {(errors as any).password && <p className="text-sm text-red-600">{(errors as any).password.message}</p>}
          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <label className="flex items-center gap-2">
              <input type="checkbox" {...register('is_active')} defaultChecked />
              <span>Active</span>
            </label>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="mt-4 w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {isSaving ? 'Creating...' : 'Create Worker'}
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
