import { User, BookOpen, Clock, Star } from "lucide-react";

export function ProfileDarkGreen() {
  return (
    <div
      className="relative h-screen w-full flex flex-col items-center justify-center px-8 text-center overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #1a4430 0%, #2c523e 60%, #162e22 100%)",
      }}
    >
      {/* Atmospheric blobs */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "-10%", left: "-15%", width: "65%", height: "55%",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: "0%", right: "-15%", width: "60%", height: "50%",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(100,200,140,0.08) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-5 max-w-xs w-full">
        {/* Avatar */}
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mb-2"
          style={{
            background: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.18)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.20)",
          }}
        >
          <User className="w-9 h-9" style={{ color: "rgba(255,255,255,0.80)", strokeWidth: 1.6 }} />
        </div>

        {/* Text */}
        <div className="flex flex-col gap-2">
          <h1
            className="font-['Manrope'] font-bold tracking-tight"
            style={{ fontSize: "28px", lineHeight: 1.1, color: "#ffffff" }}
          >
            Your Profile
          </h1>
          <p
            className="font-['Manrope'] italic leading-relaxed"
            style={{ fontSize: "16px", color: "rgba(255,255,255,0.50)" }}
          >
            Sign in to personalise your feed and keep your reading history in sync.
          </p>
        </div>

        {/* Stats row */}
        <div className="flex gap-3 w-full mt-1">
          {[
            { icon: BookOpen, label: "Read", value: "24" },
            { icon: Star, label: "Saved", value: "7" },
            { icon: Clock, label: "Hrs", value: "3.2" },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              <span className="font-['Manrope'] font-bold" style={{ fontSize: "20px", color: "#fff" }}>{value}</span>
              <span className="font-['Inter']" style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)" }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Sign in button */}
        <button
          className="mt-1 px-8 py-3 rounded-full font-['Inter'] font-semibold text-sm tracking-wide w-full"
          style={{
            background: "rgba(255,255,255,0.15)",
            color: "#ffffff",
            border: "1px solid rgba(255,255,255,0.25)",
          }}
        >
          Sign in
        </button>
      </div>

      {/* Bottom nav pill */}
      <div className="absolute bottom-0 inset-x-0 flex justify-center pb-4 pointer-events-none">
        <div
          className="flex items-center gap-1 px-3 py-2.5"
          style={{
            background: "rgba(0,0,0,0.30)",
            backdropFilter: "blur(32px)",
            borderRadius: "100px",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center justify-center"
              style={{
                width: 52, height: 44,
                borderRadius: 80,
                background: i === 2 ? "rgba(255,255,255,0.15)" : "transparent",
              }}
            >
              <User
                style={{
                  width: 20, height: 20,
                  color: i === 2 ? "#ffffff" : "rgba(255,255,255,0.40)",
                  fill: i === 2 ? "#ffffff" : "none",
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
