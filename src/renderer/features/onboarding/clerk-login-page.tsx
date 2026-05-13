"use client"

import { motion, AnimatePresence } from "motion/react"
import { useState } from "react"
import { Mail, Lock, ArrowRight, Github, Chrome, Loader2, User } from "lucide-react"
import { Logo } from "../../components/ui/logo"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { cn } from "../../lib/utils"
import { toast } from "sonner"

import { trpc } from "../../lib/trpc"
import { useSetAtom } from "jotai"
import { authTokenAtom } from "../../App"

export function ClerkLoginPage() {
  const setAuthToken = useSetAtom(authTokenAtom)
  
  const loginMutation = trpc.auth.login.useMutation()
  const registerMutation = trpc.auth.register.useMutation()

  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (isLogin) {
        const result = await loginMutation.mutateAsync({ email, password })
        localStorage.setItem("falbor_token", result.token)
        setAuthToken(result.token)
      } else {
        const result = await registerMutation.mutateAsync({ email, password, name })
        localStorage.setItem("falbor_token", result.token)
        setAuthToken(result.token)
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#050505] overflow-hidden relative">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Draggable Area */}
      <div
        className="fixed top-0 left-0 right-0 h-12 z-50"
        style={{ WebkitAppRegion: "drag" } as any}
      />

      <div
        className="w-full max-w-[400px] z-10 px-6"
      >
        <div className="flex flex-col items-center mb-8">
          <div
          >
            <Logo className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
            {isLogin ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-muted-foreground text-sm text-center">
            {isLogin
              ? "Enter your credentials to access your agents"
              : "Join Falbor to build parallel agent workflows"}
          </p>
        </div>

        <AnimatePresence mode="wait">
            <motion.form
              key="auth-form"
              initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div className="space-y-2">
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="border-0 pl-10 bg-white/5 hover:bg-white/10 focus:bg-white/10 transition-all"
                  />
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="border-0 pl-10 bg-white/5 hover:bg-white/10 focus:bg-white/10 transition-all"
                  />
                </div>
                {!isLogin && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="relative group"
                  >
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
                    <Input
                      type="text"
                      placeholder="Full Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required={!isLogin}
                      className="border-0 pl-10 bg-white/5 hover:bg-white/10 focus:bg-white/10 transition-all"
                    />
                  </motion.div>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <span className="flex items-center gap-2">
                    {isLogin ? "Sign In" : "Sign Up"}
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground mt-6">
                {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-primary hover:underline font-medium"
                >
                  {isLogin ? "Sign up" : "Log in"}
                </button>
              </p>
            </motion.form>
        </AnimatePresence>
      </div>
    </div>
  )
}
