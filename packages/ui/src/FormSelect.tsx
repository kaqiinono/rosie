'use client'

import { Select } from '@radix-ui/themes'

// Radix Select 不允许空字符串作为 Item 的 value，业务里常见的「全部 / 未选择」选项（value=""）
// 用这个占位值在组件内部转换，调用方仍然使用 ''。
const EMPTY_VALUE = '__form-select-empty__'

export type FormSelectOption = {
  value: string
  label: string
  disabled?: boolean
}

export type FormSelectProps = {
  value: string
  onValueChange: (value: string) => void
  options: FormSelectOption[]
  /** 没有匹配当前 value 的选项时显示的占位文案。 */
  placeholder?: string
  size?: '1' | '2' | '3'
  disabled?: boolean
  ariaLabel?: string
  /** 仅用于布局（宽度、外边距），不覆盖外观。 */
  className?: string
}

// 表单里的单选下拉。封装 Radix Themes Select，处理空值选项；外观只通过 size 选择。
export function FormSelect({
  value,
  onValueChange,
  options,
  placeholder,
  size = '2',
  disabled,
  ariaLabel,
  className,
}: FormSelectProps) {
  const internalValue = value === '' ? EMPTY_VALUE : value
  return (
    <Select.Root
      value={internalValue}
      onValueChange={(next) => onValueChange(next === EMPTY_VALUE ? '' : next)}
      size={size}
      disabled={disabled}
    >
      <Select.Trigger aria-label={ariaLabel} placeholder={placeholder} className={className} />
      <Select.Content position="popper">
        {options.map((option) => (
          <Select.Item
            key={option.value === '' ? EMPTY_VALUE : option.value}
            value={option.value === '' ? EMPTY_VALUE : option.value}
            disabled={option.disabled}
          >
            {option.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  )
}

export default FormSelect
