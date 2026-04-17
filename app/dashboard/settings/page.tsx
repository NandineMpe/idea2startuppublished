"use client"

import { useState } from "react"
import { Bell, ChevronRight, Shield } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"

export default function SettingsPage() {
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [marketingEmails, setMarketingEmails] = useState(false)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <Tabs defaultValue="notifications" className="space-y-6">
        <TabsList className="bg-background border border-primary/20 rounded-full p-1">
          <TabsTrigger
            value="notifications"
            className="rounded-full data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none text-foreground"
          >
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="rounded-full data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none text-foreground"
          >
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-6">
          <Card className="glass-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Notification Preferences</CardTitle>
              <CardDescription className="text-muted-foreground">Manage how and when you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="text-foreground font-medium">Email Notifications</h4>
                    <p className="text-muted-foreground text-sm">Receive notifications via email</p>
                  </div>
                  <Switch
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="text-foreground font-medium">Push Notifications</h4>
                    <p className="text-muted-foreground text-sm">Receive notifications in your browser</p>
                  </div>
                  <Switch
                    checked={pushNotifications}
                    onCheckedChange={setPushNotifications}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="text-foreground font-medium">Marketing Emails</h4>
                    <p className="text-muted-foreground text-sm">Receive emails about new features and offers</p>
                  </div>
                  <Switch
                    checked={marketingEmails}
                    onCheckedChange={setMarketingEmails}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border space-y-2">
                <h4 className="text-sm font-medium text-foreground">Where to find Juno alerts</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Briefs, leads, content queue, and staff meeting summaries appear in the app — open the{" "}
                  <a href="/dashboard" className="text-primary font-medium underline-offset-4 hover:underline">
                    Intelligence Feed
                  </a>{" "}
                  (home) and the Signal feed on the right. No phone number or third-party messaging setup is required.
                </p>
              </div>

              <div className="flex justify-end">
                <Button className="bg-primary hover:bg-primary/90 text-black font-medium">Save Preferences</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card className="glass-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Security Settings</CardTitle>
              <CardDescription className="text-muted-foreground">
                Manage your account security and authentication methods
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-primary/5">
                  <div className="space-y-0.5">
                    <h4 className="text-foreground font-medium">Change Password</h4>
                    <p className="text-muted-foreground text-sm">Update your password regularly for better security</p>
                  </div>
                  <Button
                    variant="outline"
                    className="border-primary/20 bg-background hover:bg-primary/10 hover:border-primary/50 text-foreground"
                  >
                    Change <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-primary/5">
                  <div className="space-y-0.5">
                    <h4 className="text-foreground font-medium">Two-Factor Authentication</h4>
                    <p className="text-muted-foreground text-sm">Add an extra layer of security to your account</p>
                  </div>
                  <Button
                    variant="outline"
                    className="border-primary/20 bg-background hover:bg-primary/10 hover:border-primary/50 text-foreground"
                  >
                    Enable <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-primary/5">
                  <div className="space-y-0.5">
                    <h4 className="text-foreground font-medium">Connected Accounts</h4>
                    <p className="text-muted-foreground text-sm">Manage third-party services connected to your account</p>
                  </div>
                  <Button
                    variant="outline"
                    className="border-primary/20 bg-background hover:bg-primary/10 hover:border-primary/50 text-foreground"
                  >
                    Manage <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
