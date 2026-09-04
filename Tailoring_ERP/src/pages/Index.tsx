import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { motion } from "motion/react";

function IndexInner() {
  const navigate = useNavigate();
  const data = useQuery(api.users.getCurrentUserWithTenant, {});

  useEffect(() => {
    if (data === undefined) return; // loading
    if (data === null) return; // user not in db yet
    if (!data.tenant) {
      navigate("/onboarding", { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
    }
  }, [data, navigate]);

  return (
    <div className="flex items-center justify-center h-svh">
      <Spinner className="size-8 text-primary" />
    </div>
  );
}

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <AuthLoading>
        <div className="flex items-center justify-center h-svh">
          <Spinner className="size-8 text-primary" />
        </div>
      </AuthLoading>
      <Authenticated>
        <IndexInner />
      </Authenticated>
      <Unauthenticated>
        <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-5">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  45deg,
                  oklch(0.28 0.06 265) 0px,
                  oklch(0.28 0.06 265) 1px,
                  transparent 1px,
                  transparent 60px
                )`,
              }}
            />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] as const }}
            className="relative z-10 text-center px-6 max-w-2xl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.6, ease: "easeOut" as const }}
              className="mb-8"
            >
              <span className="inline-block text-accent font-sans text-sm tracking-[0.3em] uppercase mb-4">
                The Tailor&apos;s Command Centre
              </span>
              <h1 className="font-sans text-6xl md:text-7xl font-light tracking-tight text-foreground leading-none mb-2">
                Atelier
              </h1>
              <h1 className="font-sans text-6xl md:text-7xl font-semibold tracking-tight text-primary leading-none">
                HQ
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="font-body text-lg text-muted-foreground mb-10 leading-relaxed"
            >
              Orders, customers, worker tasks, payments, and invoices — all in one elegant workspace for your tailoring business.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              <SignInButton className="px-10 py-3 text-base" />
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="absolute bottom-8 text-xs text-muted-foreground tracking-widest uppercase"
          >
            Crafted for bespoke excellence
          </motion.div>
        </div>
      </Unauthenticated>
    </div>
  );
}
