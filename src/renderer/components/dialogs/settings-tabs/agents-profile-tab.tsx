import { useState, useEffect, useCallback, useRef } from "react"
import { Input } from "../../ui/input"
import { Label } from "../../ui/label"
import { IconSpinner } from "../../../icons"
import { toast } from "sonner"
import { trpc } from "../../../lib/trpc"
import { useAtomValue } from "jotai"
import { authTokenAtom } from "../../../App"

// Hook to detect narrow screen
function useIsNarrowScreen(): boolean {
  const [isNarrow, setIsNarrow] = useState(false)

  useEffect(() => {
    const checkWidth = () => {
      setIsNarrow(window.innerWidth <= 768)
    }

    checkWidth()
    window.addEventListener("resize", checkWidth)
    return () => window.removeEventListener("resize", checkWidth)
  }, [])

  return isNarrow
}

export function AgentsProfileTab() {
  const token = useAtomValue(authTokenAtom)
  const [fullName, setFullName] = useState("")
  const isNarrowScreen = useIsNarrowScreen()
  const savedNameRef = useRef("")

  const { data: user, isLoading } = trpc.auth.me.useQuery(
    { token },
    { enabled: !!token }
  )

  const updateProfile = trpc.auth.updateProfile.useMutation()

  useEffect(() => {
    if (user) {
      setFullName(user.name || "")
      savedNameRef.current = user.name || ""
    }
  }, [user])

  const handleBlurSave = useCallback(async () => {
    const trimmed = fullName.trim()
    if (trimmed === savedNameRef.current) return
    try {
      await updateProfile.mutateAsync({ name: trimmed })
      savedNameRef.current = trimmed
      toast.success("Profile updated")
    } catch (error) {
      console.error("Error updating profile:", error)
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile"
      )
    }
  }, [fullName, updateProfile])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <IconSpinner className="h-6 w-6" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Profile Settings Card */}
      <div className="space-y-2">
        {/* Header - hidden on narrow screens since it's in the navigation bar */}
        {!isNarrowScreen && (
          <div className="flex items-center justify-between pb-3 mb-4">
            <h3 className="text-sm font-medium text-foreground">Account</h3>
          </div>
        )}
        <div className="bg-background rounded-lg border border-border overflow-hidden">
          {/* Full Name Field */}
          <div className="flex items-center justify-between p-4">
            <div className="flex-1">
              <Label className="text-sm font-medium">Full Name</Label>
              <p className="text-sm text-muted-foreground">
                This is your display name
              </p>
            </div>
            <div className="flex-shrink-0 w-80">
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onBlur={handleBlurSave}
                className="w-full"
                placeholder="Enter your name"
                disabled={updateProfile.isPending}
              />
            </div>
          </div>

          {/* Email Field (read-only) */}
          <div className="flex items-center justify-between p-4 border-t border-border">
            <div className="flex-1">
              <Label className="text-sm font-medium">Email</Label>
              <p className="text-sm text-muted-foreground">
                Your account email
              </p>
            </div>
            <div className="flex-shrink-0 w-80">
              <Input
                value={user?.email || ""}
                disabled
                className="w-full opacity-60"
              />
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}

