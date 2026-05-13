"use client"

import { useSignIn, useSignUp } from "@clerk/clerk-react"
import { motion, AnimatePresence } from "motion/react"
import { useState } from "react"
import { Mail, Lock, ArrowRight, Github, Chrome, Loader2 } from "lucide-react"
import { Logo } from "../../components/ui/logo"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { cn } from "../../lib/utils"
import { toast } from "sonner"

export function ClerkLoginPage() {
  const { isLoaded: isSignInLoaded, signIn, setActive: setSignInActive } = useSignIn()
  const { isLoaded: isSignUpLoaded, signUp, setActive: setSignUpActive } = useSignUp()

  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [code, setCode] = useState("")

  const handleOAuth = async (strategy: "oauth_google" | "oauth_github") => {
    if (!isSignInLoaded) return
    try {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      })
    } catch (err: any) {
      toast.error(err.errors?.[0]?.message || "OAuth failed")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSignInLoaded || !isSignUpLoaded) return
    setIsLoading(true)

    try {
      if (isLogin) {
        const result = await signIn.create({
          identifier: email,
          password,
        })

        if (result.status === "complete") {
          await setSignInActive({ session: result.createdSessionId })
        } else {
          console.log(result)
        }
      } else {
        await signUp.create({
          emailAddress: email,
          password,
        })

        await signUp.prepareEmailAddressVerification({ strategy: "email_code" })
        setVerifying(true)
      }
    } catch (err: any) {
      toast.error(err.errors?.[0]?.message || "Authentication failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSignUpLoaded) return
    setIsLoading(true)

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      })
      if (completeSignUp.status === "complete") {
        await setSignUpActive({ session: completeSignUp.createdSessionId })
      }
    } catch (err: any) {
      toast.error(err.errors?.[0]?.message || "Verification failed")
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
            {verifying ? "Verify your email" : isLogin ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-muted-foreground text-sm text-center">
            {verifying
              ? `We sent a code to ${email}`
              : isLogin
                ? "Enter your credentials to access your agents"
                : "Join Falbor to build parallel agent workflows"}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {!verifying ? (
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
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="border-0"
                  />
                </div>
                <div className="relative group">
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="border-0"
                  />
                </div>
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
              <div className="grid grid-cols-1 gap-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOAuth("oauth_google")}
                >
                  <img src="https://s3-alpha.figma.com/hub/file/2729744958/2a5758d6-4edb-4047-87bb-e6b94dbbbab0-cover.png" width={33} alt="" />
                  Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOAuth("oauth_github")}
                >
                  <Github className="w-4 h-4 mr-2" />
                  GitHub
                </Button>
              </div>

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
          ) : (
            <motion.form
              key="verify-form"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onSubmit={handleVerify}
              className="space-y-4"
            >
              <Input
                type="text"
                placeholder="Verification code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="h-11 bg-white/5 border-white/10 focus:border-primary/50 text-center text-xl tracking-[1em] font-bold rounded-xl"
              />
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 rounded-xl bg-primary"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify Code"}
              </Button>
              <button
                type="button"
                onClick={() => setVerifying(false)}
                className="w-full text-sm text-muted-foreground hover:text-white transition-colors"
              >
                Back to sign up
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
