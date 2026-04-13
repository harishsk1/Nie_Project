import * as React from "react";
import { cn } from "../../lib/utils";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { label: string; value: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "border rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500",
        className
      )}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
);

Select.displayName = "Select";

// new fancier

/* import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

const Select = React.forwardRef<
  HTMLButtonElement,
  SelectPrimitive.SelectTriggerProps
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Root>
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="ml-2 h-4 w-4 text-gray-500" />
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Content className="z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg focus:outline-none">
      <SelectPrimitive.Viewport className="p-1" />
    </SelectPrimitive.Content>
    
  </SelectPrimitive.Root>
));
Select.displayName = "Select";

const SelectItem = React.forwardRef<
  HTMLDivElement,
  SelectPrimitive.SelectItemProps
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none",
      className
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="absolute right-2 flex items-center">
      <Check className="h-4 w-4" />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = "SelectItem";

export { Select, SelectItem };
 */
