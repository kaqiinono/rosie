// Shared by the course editor and its pickers; focus never changes control geometry.
export const courseFocusClass = 'outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600'

export const courseFieldFocusClass = 'focus-within:bg-emerald-50/50 focus-within:ring-2 focus-within:ring-inset focus-within:ring-emerald-600'

export const courseInputClass = 'min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-inset focus:ring-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500'

export const courseButtonClass = `inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 active:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-50 ${courseFocusClass} focus-visible:ring-emerald-300!`

export const courseSecondaryButtonClass = `inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 active:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 ${courseFocusClass}`
