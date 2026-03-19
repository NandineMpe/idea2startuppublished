"use client"

import { useState } from "react"
import { Bell, ChevronRight, Palette, Shield, User } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function SettingsPage() {
  const [name, setName] = useState("Alex Johnson")
  const [email, setEmail] = useState("alex@ideatostartup.io")
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [marketingEmails, setMarketingEmails] = useState(false)
  const [theme, setTheme] = useState("dark")
  const [language, setLanguage] = useState("en")

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-background border border-primary/20 rounded-full p-1">
          <TabsTrigger
            value="profile"
            className="rounded-full data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none text-foreground"
          >
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="rounded-full data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none text-foreground"
          >
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger
            value="appearance"
            className="rounded-full data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none text-foreground"
          >
            <Palette className="h-4 w-4 mr-2" />
            Appearance
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="rounded-full data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none text-foreground"
          >
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card className="glass-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Profile Information</CardTitle>
              <CardDescription className="text-muted-foreground">
                Update your personal information and how it appears on your profile
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="name" className="text-foreground">
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="glass-input text-foreground border-border focus-visible:ring-primary/30"
                  />
                </div>
                <div className="space-y-2 flex-1">
                  <Label htmlFor="email" className="text-foreground">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="glass-input text-foreground border-border focus-visible:ring-primary/30"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio" className="text-foreground">
                  Bio
                </Label>
                <textarea
                  id="bio"
                  rows={4}
                  placeholder="Tell us about yourself and your startup journey..."
                  className="w-full glass-input text-foreground border-border focus-visible:ring-primary/30 rounded-md p-2"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="language" className="text-foreground">
                  Language
                </Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="glass-input text-foreground border-border focus-visible:ring-primary/30">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent className="glass border-border">
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="zh">Chinese</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end">
                <Button className="bg-primary hover:bg-primary/90 text-black font-medium">Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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

              <div className="flex justify-end">
                <Button className="bg-primary hover:bg-primary/90 text-black font-medium">Save Preferences</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card className="glass-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Appearance Settings</CardTitle>
              <CardDescription className="text-muted-foreground">Customize how ideatostartup.io looks for you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Theme</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <div
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        theme === "dark"
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background/40 hover:border-primary/30"
                      }`}
                      onClick={() => setTheme("dark")}
                    >
                      <div className="h-20 rounded-md bg-background border border-border flex items-center justify-center">
                        <span className="text-primary text-sm">Dark</span>
                      </div>
                    </div>
                    <div
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        theme === "light"
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background/40 hover:border-primary/30"
                      }`}
                      onClick={() => setTheme("light")}
                    >
                      <div className="h-20 rounded-md bg-white border border-black/10 flex items-center justify-center">
                        <span className="text-black text-sm">Light</span>
                      </div>
                    </div>
                    <div
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        theme === "system"
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background/40 hover:border-primary/30"
                      }`}
                      onClick={() => setTheme("system")}
                    >
                      <div className="h-20 rounded-md bg-gradient-to-b from-white to-black border border-border flex items-center justify-center">
                        <span className="text-foreground text-sm">System</span>
                      </div>
                    </div>
                  </div>
                </div>
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
