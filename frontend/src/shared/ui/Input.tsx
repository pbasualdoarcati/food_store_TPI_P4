import type { InputHTMLAttributes } from 'react';
import { inputClass } from './styles';

function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputClass} ${className}`} {...props} />;
}

export default Input;
