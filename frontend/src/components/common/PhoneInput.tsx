interface PhoneInputProps {
  value: string;
  onChange: (fullPhone: string) => void;
  error?: boolean;
}

export function PhoneInput({ value, onChange, error }: PhoneInputProps) {
  const digits = value.startsWith("+380") ? value.slice(4) : "";

  return (
    <div
      className={`flex items-center border rounded-md overflow-hidden ${error ? "border-red-400" : "border-gray-300"} focus-within:ring-2 focus-within:ring-blue-600`}
    >
      <span className="px-3 py-3 bg-gray-100 text-sm text-gray-600 select-none">
        +380
      </span>
      <input
        type="tel"
        inputMode="numeric"
        maxLength={9}
        className="flex-1 px-3 py-3 text-sm outline-none bg-transparent"
        value={digits}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 9);
          onChange("+380" + v);
        }}
        placeholder="XXXXXXXXX"
      />
    </div>
  );
}
