import UsersSecurityView from "../components/UsersSecurityView";

export const metadata = {
  title: "Administrar Usuarios | Bikers Fort",
};

export default function UsersPage() {
  return (
    <div className="p-4 md:p-6 w-full max-w-[1600px] mx-auto min-h-screen relative bg-[var(--bg-color)]">
      <UsersSecurityView />
    </div>
  );
}
