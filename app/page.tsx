import PaymentModal from "@/components/PaymentModal";

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-md p-6 text-center flex flex-col items-center gap-6">
        <div className="mx-auto max-w-5xl rounded-2xl shadow-xl overflow-hidden mb-4 w-full">
          <img
            src="/branding/st-banner-1200x600.png"
            alt="Smart Turjman — AI Service Router"
            className="w-full h-auto block"
            loading="eager"
          />
        </div>
        <div className="w-full flex justify-center">
          <PaymentModal />
        </div>
      </div>
    </main>
  );
}
