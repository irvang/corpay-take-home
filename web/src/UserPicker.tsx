import type { DemoUser } from './types.ts';

type Props = {
  users: DemoUser[];
  userId: number | null;
  onChange: (userId: number | null) => void;
};

export function UserPicker({ users, userId, onChange }: Props) {
  return (
    <label className="user-picker">
      Acting as{' '}
      <select value={userId ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
        <option value="">Pick a demo user</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} ({user.role}, {user.companyName})
          </option>
        ))}
      </select>
    </label>
  );
}
