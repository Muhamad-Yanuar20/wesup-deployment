export function AdminHeader({ title, description }: { title: string; description?: string }) {
 return <header className="wesup-feedback shrink-0 border-b border-slate-200 bg-white px-4 py-5 sm:px-6"><h1 className="wesup-state-title text-2xl leading-tight text-slate-950">{title}</h1>{description && <p className="mt-2 max-w-prose text-sm leading-6 text-slate-600">{description}</p>}</header>;
}
