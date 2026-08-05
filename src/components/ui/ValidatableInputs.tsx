"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { 
  validateRNC, 
  formatPhoneDR, 
  validatePhoneDR, 
  validateEmail, 
  validateURL, 
  validateRequiredText 
} from "@/lib/validations";

interface InputProps {
  label?: string;
  value: string;
  onChange: (value: string, isValid: boolean, errorMessage: string) => void;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxLength?: number;
  icon?: React.ReactNode;
}

// ----------------------------------------------------
// 1. RNC INPUT (9 or 11 digits, DR format)
// ----------------------------------------------------
export function RNCInput({
  label = "RNC",
  value = "",
  onChange,
  required = false,
  placeholder = "Ej. 101123456 o 13145678901",
  disabled = false,
  className = ""
}: InputProps) {
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const digitsOnly = rawVal.replace(/\D/g, "").slice(0, 11);
    const valRes = validateRNC(digitsOnly, required);
    const err = valRes.isValid ? "" : valRes.message;
    setError(err);
    onChange(digitsOnly, valRes.isValid, err);
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block">
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
      )}
      <input
        type="text"
        disabled={disabled}
        maxLength={11}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full bg-[#0e1117] border rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all ${
          error ? "border-rose-500 focus:border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
        }`}
      />
      {error && (
        <div className="flex items-center gap-1 mt-1 text-[11px] text-rose-400 font-mono">
          <AlertCircle size={12} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// 2. TELÉFONO INPUT (DR format: 809/829/849)
// ----------------------------------------------------
export function PhoneInput({
  label = "Teléfono",
  value = "",
  onChange,
  required = false,
  placeholder = "Ej. (809) 555-0199",
  disabled = false,
  className = "",
  icon
}: InputProps) {
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const { formatted, digits } = formatPhoneDR(raw);
    const valRes = validatePhoneDR(formatted, required);
    const err = valRes.isValid ? "" : valRes.message;
    setError(err);
    onChange(formatted, valRes.isValid, err);
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block flex items-center gap-1">
          {icon}
          <span>{label}</span> {required && <span className="text-rose-400">*</span>}
        </label>
      )}
      <input
        type="text"
        disabled={disabled}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full bg-[#0e1117] border rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all ${
          error ? "border-rose-500 focus:border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
        }`}
      />
      {error && (
        <div className="flex items-center gap-1 mt-1 text-[11px] text-rose-400 font-mono">
          <AlertCircle size={12} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// 3. EMAIL INPUT (Standard RFC, auto lowercase)
// ----------------------------------------------------
export function EmailInput({
  label = "Email",
  value = "",
  onChange,
  required = false,
  placeholder = "contacto@empresa.com",
  disabled = false,
  className = "",
  icon
}: InputProps) {
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.trim().toLowerCase();
    const valRes = validateEmail(clean, required);
    const err = valRes.isValid ? "" : valRes.message;
    setError(err);
    onChange(clean, valRes.isValid, err);
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block flex items-center gap-1">
          {icon}
          <span>{label}</span> {required && <span className="text-rose-400">*</span>}
        </label>
      )}
      <input
        type="email"
        disabled={disabled}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full bg-[#0e1117] border rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all ${
          error ? "border-rose-500 focus:border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
        }`}
      />
      {error && (
        <div className="flex items-center gap-1 mt-1 text-[11px] text-rose-400 font-mono">
          <AlertCircle size={12} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// 4. URL INPUT (Flexible URL validation)
// ----------------------------------------------------
export function URLInput({
  label = "Sitio Web",
  value = "",
  onChange,
  required = false,
  placeholder = "https://empresa.com",
  disabled = false,
  className = "",
  icon
}: InputProps) {
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    const valRes = validateURL(val, required);
    const err = valRes.isValid ? "" : valRes.message;
    setError(err);
    onChange(val, valRes.isValid, err);
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block flex items-center gap-1">
          {icon}
          <span>{label}</span> {required && <span className="text-rose-400">*</span>}
        </label>
      )}
      <input
        type="text"
        disabled={disabled}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full bg-[#0e1117] border rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all ${
          error ? "border-rose-500 focus:border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
        }`}
      />
      {error && (
        <div className="flex items-center gap-1 mt-1 text-[11px] text-rose-400 font-mono">
          <AlertCircle size={12} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// 5. TEXT INPUT (Required / Trimmed text)
// ----------------------------------------------------
export function ValidatableTextInput({
  label,
  value = "",
  onChange,
  required = false,
  placeholder = "",
  disabled = false,
  className = "",
  maxLength = 100,
  icon
}: InputProps) {
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    let err = "";
    if (required && !val.trim()) {
      err = `${label || "Este campo"} es obligatorio.`;
    } else if (val.trim().length > maxLength) {
      err = `${label || "Este campo"} no puede exceder ${maxLength} caracteres.`;
    }
    setError(err);
    onChange(val, !err, err);
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block flex items-center gap-1">
          {icon}
          <span>{label}</span> {required && <span className="text-rose-400">*</span>}
        </label>
      )}
      <input
        type="text"
        disabled={disabled}
        maxLength={maxLength}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full bg-[#0e1117] border rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all ${
          error ? "border-rose-500 focus:border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
        }`}
      />
      {error && (
        <div className="flex items-center gap-1 mt-1 text-[11px] text-rose-400 font-mono">
          <AlertCircle size={12} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
