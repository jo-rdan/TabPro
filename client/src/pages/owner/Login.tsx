import AnimatedLogo from "../../components/AnimatedLogo";
import GoogleIcon from "../../components/GoogleIcon";

export default function Login() {
  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || "/api"}/auth/google?from=${encodeURIComponent(window.location.origin)}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#2B1838] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Card */}
      <div className="relative w-full max-w-sm">
        {/* Logo + wordmark */}
        <div className="flex flex-col items-center mb-8">
          <h1 className="mb-2">
            <AnimatedLogo size={48} on="light" bg="#F7F5F9" className="dark:hidden" />
            <AnimatedLogo size={48} on="dark" bg="#1B1524" className="hidden dark:inline-flex" />
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Less waiting. More fun.
          </p>
        </div>

        {/* Login card */}
        <div
          className="
          bg-white dark:bg-[#3B2149]
          border border-gray-200 dark:border-gray-800
          rounded-2xl shadow-sm
          p-8
        "
        >
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
            Owner sign in
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
            Access your dashboard to manage your venue, menu, and team.
          </p>

          <button
            onClick={handleGoogleLogin}
            className="
              w-full flex items-center justify-center gap-3
              bg-white dark:bg-[#4A2D5C]
              border border-gray-200 dark:border-gray-700
              hover:bg-gray-50 dark:hover:bg-[#573469]
              text-gray-800 dark:text-gray-200
              text-sm font-medium
              rounded-xl px-4 py-3
              transition-colors duration-150
              shadow-sm
              focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
              dark:focus:ring-offset-[#231A2C]
            "
          >
            <GoogleIcon size={18} />
            Continue with Google
          </button>

          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center leading-relaxed">
              For venue owners only.{" "}
              <span className="text-gray-500 dark:text-gray-400">
                Staff access is via invite link.
              </span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-6">
          © {new Date().getFullYear()} Skuzi ·{" "}
          <a
            href={`${import.meta.env.VITE_APP_URL}/privacy.html`}
            target="_blank"
            className="underline hover:text-gray-500 transition-colors"
          >
            Privacy Policy
          </a>
          {" · "}
          <a
            href={`${import.meta.env.VITE_APP_URL}/terms.html`}
            target="_blank"
            className="underline hover:text-gray-500 transition-colors"
          >
            Terms
          </a>
        </p>
      </div>
    </div>
  );
}
