export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left — Branding */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-primary text-primary-foreground">
        <div className="max-w-md space-y-4 px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground text-primary text-lg font-bold">
              F
            </div>
            <span className="text-2xl font-bold tracking-tight">Fashnix</span>
          </div>
          <p className="text-lg text-primary-foreground/80">
            AI-powered fashion intelligence for modern brands.
          </p>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              F
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Fashnix
            </span>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
