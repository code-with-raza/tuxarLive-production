export function AccountCheckError({ message }: { message: string }) {
  return (
    <div className="container-luxe py-24 text-center" role="alert">
      <p className="mb-6">{message}</p>
      <button type="button" onClick={() => window.location.reload()} className="min-h-12 border border-foreground px-6">
        Try again
      </button>
    </div>
  );
}
