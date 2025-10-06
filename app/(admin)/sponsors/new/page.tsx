"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react"
import Link from "next/link"
import { sponsorConfigs, PlatformKey } from "@/lib/sponsor-config"

const platforms: { id: PlatformKey; name: string }[] = [
  { id: "everflow", name: "Everflow" },
  { id: "hitpath", name: "Hitpath" },
  { id: "cake", name: "Cake" },
  { id: "hasoffers", name: "HasOffers" },
]

interface PlatformConfig {
  api_url_offer?: string
  api_url_reporting?: string
  login_driver?: string
  tracking_template?: string
}

interface SponsorFormData {
  api_driver: PlatformKey | ''
  name: string
  affiliate_number: string
  api_key: string
  username: string
  password: string
  status: 'active' | 'inactive'
  api_url_offer?: string
  api_url_reporting?: string
  login_driver?: string
  tracking_template?: string
}

export default function NewSponsorPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)

  const [formData, setFormData] = useState<SponsorFormData>({
    api_driver: '',
    name: '',
    affiliate_number: '',
    api_key: '',
    username: '',
    password: '',
    status: 'active',
  })

  const totalSteps = 2

  function isStepValid() {
    if (currentStep === 1) return !!formData.api_driver

    if (currentStep === 2) {
      if (!formData.name.trim() || !formData.affiliate_number.trim()) return false
      if (formData.api_driver === 'cake') {
        return !!formData.username.trim() && !!formData.password.trim()
      }
      if (formData.api_driver === 'everflow') {
        return !!formData.api_key.trim()
      }
      return true
    }
    return true
  }

  const handleNext = () => {
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1)
  }

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  async function testConnection() {
    if (formData.api_driver !== 'everflow') {
      setTestResult('Test currently only supported for Everflow')
      return
    }
    if (!formData.api_key.trim()) {
      setTestResult('API Key is required for testing connection')
      return
    }

    setTestResult(null)
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('https://api.eflow.team/v1/affiliates/affiliate', {
        method: 'GET',
        headers: {
          'X-Eflow-API-Key': formData.api_key,
          'Content-Type': 'application/json',
        },
      })
      if (!res.ok) throw new Error(`Status ${res.status}`)
      setTestResult('Connection successful')
    } catch (err: unknown) {
      if (err instanceof Error) setError(`Connection failed: ${err.message || err.toString()}`)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    setTestResult(null)

    try {
      const platformConfig: PlatformConfig = formData.api_driver ? sponsorConfigs[formData.api_driver] : {}

      const payload = {
        ...formData,
        api_url_offer: platformConfig.api_url_offer || '',
        api_url_reporting: platformConfig.api_url_reporting || '',
        login_driver: platformConfig.login_driver || '',
        tracking_template: platformConfig.tracking_template || '',
      }

      const response = await fetch('/api/sponsors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const resp = await response.json()
        throw new Error(resp.error || 'Failed to create sponsor')
      }

      setIsLoading(false)
      router.push('/dashboard/sponsors')
    } catch (err: unknown) {
      if (err instanceof Error) {
        setIsLoading(false)
        setError(err.message || 'Unknown error')
      }
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <Link href="/dashboard/sponsors" className="underline mb-4 inline-block">
        &larr; Back to Sponsors
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Add New Sponsor</CardTitle>
          <CardDescription>
            {currentStep === 1 && 'Select the affiliate tracking platform'}
            {currentStep === 2 && 'Enter sponsor details'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {currentStep === 1 && (
              <div className="grid gap-4">
                {platforms.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`p-4 border rounded ${
                      formData.api_driver === p.id ? 'border-primary bg-primary/10' : 'border-gray-300'
                    }`}
                    onClick={() => setFormData((f) => ({ ...f, api_driver: p.id as PlatformKey }))}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}

            {currentStep === 2 && (
              <>
                <div>
                  <Label htmlFor="name">Sponsor Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter sponsor name"
                    value={formData.name}
                    onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <Label htmlFor="affiliate_number">Affiliate Number</Label>
                  <Input
                    id="affiliate_number"
                    type="text"
                    placeholder="Enter affiliate number"
                    value={formData.affiliate_number}
                    onChange={(e) => setFormData((f) => ({ ...f, affiliate_number: e.target.value }))}
                    required
                  />
                </div>

                {formData.api_driver === 'cake' && (
                  <>
                    <div>
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData((f) => ({ ...f, username: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData((f) => ({ ...f, password: e.target.value }))}
                        required
                      />
                    </div>
                  </>
                )}

                {(formData.api_driver === 'everflow' || formData.api_driver === 'cake') && (
                  <div>
                    <Label htmlFor="api_key">API Key</Label>
                    <Input
                      id="api_key"
                      type="text"
                      value={formData.api_key}
                      onChange={(e) => setFormData((f) => ({ ...f, api_key: e.target.value }))}
                      required
                    />
                  </div>
                )}

                <div className="pt-4 flex items-center space-x-4">
                  <Button type="button" variant="outline" onClick={testConnection} disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4 mr-2" /> Testing...
                      </>
                    ) : (
                      'Test Connection'
                    )}
                  </Button>
                  {testResult && <p className="text-green-600">{testResult}</p>}
                  {error && <p className="text-red-600">{error}</p>}
                </div>
              </>
            )}

            <div className="flex justify-between pt-6">
              <Button type="button" variant="outline" onClick={handlePrevious} disabled={currentStep === 1 || isLoading}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>

              {currentStep < totalSteps ? (
                <Button type="button" onClick={handleNext} disabled={!isStepValid() || isLoading}>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={!isStepValid() || isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Create Sponsor
                      <Check className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
