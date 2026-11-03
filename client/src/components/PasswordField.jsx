import { useState } from 'react';
import { IconEye, IconEyeOff, IconLock } from '@tabler/icons-react';

export default function PasswordField({
  value,
  onChange,
  label = 'Password',
  placeholder = 'Password',
  minLength,
  locked = false,
  autoComplete,
}) {
  const [show, setShow] = useState(false);

  return (
    <label className={`field${locked ? ' locked' : ''}`}>
      <span>
        {locked && <IconLock size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} />}
        {label}
      </span>
      <div className="password-wrap">
        <input
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          minLength={minLength}
          disabled={locked}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          disabled={locked}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <IconEyeOff size={18} /> : <IconEye size={18} />}
        </button>
      </div>
    </label>
  );
}