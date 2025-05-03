"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Download, ExternalLink, Search, Filter, ArrowUpDown, Star, DollarSign, Calendar, Tag } from "lucide-react"

// Define the pitch deck examples
const pitchDecks = [
  {
    id: "uber",
    name: "Uber",
    description: "Uber's original pitch deck that raised their first round of funding",
    industry: "Transportation",
    stage: "Seed",
    amount: "$200K",
    year: "2008",
    rating: 4.8,
    tags: ["marketplace", "transportation", "mobile"],
    url: "https://cvjdrblhcif4qupj.public.blob.vercel-storage.com/Pitch%20Decks/Uber%20Pitch%20Deck-0FHzHwSKxByHmd8NVU5O8US6ijQQdL-CD1zDWRQvOuzqFHgj1QWlfek3CpMah.pdf",
    thumbnail:
      "https://cvjdrblhcif4qupj.public.blob.vercel-storage.com/Pitch%20Deck%20Images/Uber-ziFWiEJ43RrT8hPD53wW7sBySTrdHK.png",
    featured: true,
  },
  {
    id: "vercel",
    name: "Vercel",
    description: "Vercel's pitch deck that helped them raise venture capital",
    industry: "Developer Tools",
    stage: "Series A",
    amount: "$21M",
    year: "2020",
    rating: 4.9,
    tags: ["developer tools", "cloud", "deployment"],
    url: "https://cvjdrblhcif4qupj.public.blob.vercel-storage.com/Pitch%20Decks/Vercel%20Pitch%20Deck-iu9YA7UwCPCuzd1wfekGZcKAWLDfUg-sBs8Dmd9Uwh2lPvC72X7B359vaSU5y.pdf",
    thumbnail:
      "https://cvjdrblhcif4qupj.public.blob.vercel-storage.com/Pitch%20Deck%20Images/Vercel-9kcUwOAVUQ6r3e25QC5iWMeVbl9Tvq.png",
    featured: true,
  },
  {
    id: "perplexity",
    name: "Perplexity",
    description: "Perplexity's pitch deck for their AI search engine",
    industry: "AI / Search",
    stage: "Series B",
    amount: "$73.6M",
    year: "2023",
    rating: 4.7,
    tags: ["ai", "search", "nlp"],
    url: "https://adtmi1hoep2dtmuq.public.blob.vercel-storage.com/Pitch%20Decks/Perplexity%20Pitch%20Deck-hOvIOB71YvDLLikZQvGXYXHDEMqwgj.pdf",
    thumbnail:
      "https://cvjdrblhcif4qupj.public.blob.vercel-storage.com/Pitch%20Deck%20Images/Perplexity-yAPmka8sBlp1GXn3Z6xOmiAMsct7wC.png",
    featured: true,
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    description: "ElevenLabs' pitch deck for their AI voice technology",
    industry: "AI / Voice",
    stage: "Series A",
    amount: "$19M",
    year: "2023",
    rating: 4.6,
    tags: ["ai", "voice", "audio"],
    url: "https://cvjdrblhcif4qupj.public.blob.vercel-storage.com/Pitch%20Decks/Eleven%20Labs%20Pitch%20Deck-9ASHrdOgkw9mocDnceNqKAwXq1Rb5Z-fX1cxcknweASxO8FJXWKYA5wPb0WZY.pdf",
    thumbnail:
      "https://cvjdrblhcif4qupj.public.blob.vercel-storage.com/Pitch%20Deck%20Images/Eleven-XFUFHBloi67CCdMV67eKaT00mNgpMw.png",
    featured: false,
  },
  {
    id: "deckmatch",
    name: "DeckMatch",
    description: "DeckMatch's $1M seed round pitch deck",
    industry: "Fintech",
    stage: "Seed",
    amount: "$1M",
    year: "2022",
    rating: 4.5,
    tags: ["fintech", "marketplace", "fundraising"],
    url: "https://cvjdrblhcif4qupj.public.blob.vercel-storage.com/Pitch%20Decks/DeckMatch%27s%20%241M%20Seed%20deck-9DIGVcivAfCBFmZuruAu3O0RkFcWRF-oXk0FSdeV1ixH29bIv9uqfCyFfkaIn.pdf",
    thumbnail:
      "https://cvjdrblhcif4qupj.public.blob.vercel-storage.com/Pitch%20Deck%20Images/Deckmatch-fiKp3r8rYQC55MPjxV4znaQeiXizAa.png",
    featured: false,
  },
  {
    id: "feel",
    name: "Feel",
    description: "Feel's seed round pitch deck for their mental health platform",
    industry: "Health Tech",
    stage: "Seed",
    amount: "$800K",
    year: "2021",
    rating: 4.3,
    tags: ["health", "mental health", "wearables"],
    url: "https://cvjdrblhcif4qupj.public.blob.vercel-storage.com/Pitch%20Decks/Feel%20Seed%20Pitch%20Deck-MXH1Wm85DzdK86vC0OpPTirA5Jr6zr-AcijVUbaTksJidWGYA3tGxwVSEylux.pdf",
    thumbnail:
      "https://cvjdrblhcif4qupj.public.blob.vercel-storage.com/Pitch%20Deck%20Images/Feel-0hrZkMcUaBzDix6vN8BIcGAmbzIJ6L.png",
    featured: false,
  },
  {
    id: "geodesic",
    name: "Geodesic",
    description: "Geodesic's pre-seed pitch deck",
    industry: "Enterprise Software",
    stage: "Pre-Seed",
    amount: "$350K",
    year: "2020",
    rating: 4.2,
    tags: ["enterprise", "software", "infrastructure"],
    url: "https://cvjdrblhcif4qupj.public.blob.vercel-storage.com/Pitch%20Decks/Geodesic%20pre-seed%20pitch%20deck-H6pYvnyNYgC0FNpDCbVyZpP7SS58jA-N4mNgKZzbpNaLR7JIplMCX8s1fX9Fp.pdf",
    thumbnail:
      "https://cvjdrblhcif4qupj.public.blob.vercel-storage.com/Pitch%20Deck%20Images/Geodesic-bjBAdHHXuuXUsHYy9fPTgXhxslldCI.png",
    featured: false,
  },
  {
    id: "tanbii",
    name: "Tanbii",
    description: "Tanbii's pitch deck for their AI-powered platform",
    industry: "AI / Enterprise",
    stage: "Seed",
    amount: "$1.2M",
    year: "2022",
    rating: 4.4,
    tags: ["ai", "enterprise", "automation"],
    url: "https://cvjdrblhcif4qupj.public.blob.vercel-storage.com/Pitch%20Decks/Tanbii%20Pitch%20Deck-SFuzcMp5qsXjICiLdKeA97NcYQWwwg-qpdCmpBAX4jmuQdzIQqjyhMSMRZ7AR.pdf",
    thumbnail:
      "https://cvjdrblhcif4qupj.public.blob.vercel-storage.com/Pitch%20Deck%20Images/Tanbii-gpUtLOZDhdAjPH2jedZD08ivdudKCn.png",
    featured: false,
  },
]

export function PitchExamples() {
  const [activeTab, setActiveTab] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState("featured")
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null)
  const [showSortMenu, setShowSortMenu] = useState(false)

  // Filter decks based on search term and active tab
  const filteredDecks = pitchDecks.filter((deck) => {
    const matchesSearch =
      deck.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deck.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deck.industry.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deck.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))

    if (activeTab === "all") return matchesSearch
    if (activeTab === "featured") return matchesSearch && deck.featured
    if (activeTab === "seed") return matchesSearch && deck.stage.includes("Seed")
    if (activeTab === "series") return matchesSearch && deck.stage.includes("Series")

    return matchesSearch
  })

  // Sort decks based on sort option
  const sortedDecks = [...filteredDecks].sort((a, b) => {
    if (sortBy === "featured") {
      if (a.featured && !b.featured) return -1
      if (!a.featured && b.featured) return 1
      return b.rating - a.rating
    }
    if (sortBy === "rating") return b.rating - a.rating
    if (sortBy === "recent") return Number.parseInt(b.year) - Number.parseInt(a.year)
    if (sortBy === "name") return a.name.localeCompare(b.name)

    return 0
  })

  return (
    <div className="space-y-6">
      <Card className="glass-card border-primary/10">
        <CardHeader className="pb-3">
          <CardTitle>Successful Pitch Deck Examples</CardTitle>
          <CardDescription>Learn from real pitch decks that helped startups raise millions in funding.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
              <Input
                placeholder="Search by name, industry, or tag..."
                className="pl-9 bg-black/50 border-gray-800"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="border-gray-800 gap-2">
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">Filter</span>
              </Button>
              <div className="relative">
                <Button
                  variant="outline"
                  className="border-gray-800 gap-2"
                  onClick={() => setShowSortMenu(!showSortMenu)}
                >
                  <ArrowUpDown className="h-4 w-4" />
                  <span className="hidden sm:inline">Sort</span>
                </Button>
                {showSortMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-black/90 border border-gray-800 rounded-md shadow-lg z-10">
                    <div className="py-1">
                      <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800"
                        onClick={() => {
                          setSortBy("featured")
                          setShowSortMenu(false)
                        }}
                      >
                        Featured
                      </button>
                      <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800"
                        onClick={() => {
                          setSortBy("rating")
                          setShowSortMenu(false)
                        }}
                      >
                        Highest Rated
                      </button>
                      <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800"
                        onClick={() => {
                          setSortBy("recent")
                          setShowSortMenu(false)
                        }}
                      >
                        Most Recent
                      </button>
                      <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800"
                        onClick={() => {
                          setSortBy("name")
                          setShowSortMenu(false)
                        }}
                      >
                        Alphabetical
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-black/50 rounded-lg h-auto p-1">
              <TabsTrigger
                value="all"
                className="py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md"
              >
                All Decks
              </TabsTrigger>
              <TabsTrigger
                value="featured"
                className="py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md"
              >
                Featured
              </TabsTrigger>
              <TabsTrigger
                value="seed"
                className="py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md"
              >
                Seed Stage
              </TabsTrigger>
              <TabsTrigger
                value="series"
                className="py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md"
              >
                Series A+
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              {sortedDecks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedDecks.map((deck) => (
                    <Card
                      key={deck.id}
                      className="glass-card border-primary/10 overflow-hidden hover:border-primary transition-all duration-200 cursor-pointer"
                      onClick={() => setSelectedDeck(deck.id)}
                    >
                      <div className="relative h-48 overflow-hidden bg-black/50">
                        <img
                          src={deck.thumbnail || "/placeholder.svg"}
                          alt={`${deck.name} Pitch Deck`}
                          className="w-full h-full object-cover"
                        />
                        {deck.featured && (
                          <div className="absolute top-2 right-2 bg-primary text-black text-xs font-medium px-2 py-1 rounded-full">
                            Featured
                          </div>
                        )}
                      </div>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-semibold text-lg">{deck.name}</h3>
                          <div className="flex items-center">
                            <Star className="h-3 w-3 text-primary fill-primary" />
                            <span className="text-xs ml-1">{deck.rating}</span>
                          </div>
                        </div>
                        <p className="text-sm text-white/60 mb-3 line-clamp-2">{deck.description}</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <div className="flex items-center text-xs bg-black/50 px-2 py-1 rounded-full">
                            <DollarSign className="h-3 w-3 mr-1" />
                            {deck.amount}
                          </div>
                          <div className="flex items-center text-xs bg-black/50 px-2 py-1 rounded-full">
                            <Calendar className="h-3 w-3 mr-1" />
                            {deck.year}
                          </div>
                          <div className="flex items-center text-xs bg-black/50 px-2 py-1 rounded-full">
                            <Tag className="h-3 w-3 mr-1" />
                            {deck.stage}
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="text-xs text-white/60">{deck.industry}</div>
                          <Button variant="ghost" size="sm" className="h-8 px-2">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-white/60">
                  <p>No pitch decks found matching your search criteria.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {selectedDeck && (
        <Card className="glass-card border-primary/10">
          <CardHeader className="flex flex-row justify-between items-start">
            <div>
              <CardTitle>{pitchDecks.find((deck) => deck.id === selectedDeck)?.name} Pitch Deck</CardTitle>
              <CardDescription>{pitchDecks.find((deck) => deck.id === selectedDeck)?.description}</CardDescription>
            </div>
            <Button variant="outline" className="border-gray-800" onClick={() => setSelectedDeck(null)}>
              Close
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="aspect-[4/3] w-full bg-black/50 rounded-lg overflow-hidden">
              <iframe
                src={pitchDecks.find((deck) => deck.id === selectedDeck)?.url}
                className="w-full h-full"
                title={`${pitchDecks.find((deck) => deck.id === selectedDeck)?.name} Pitch Deck`}
              />
            </div>

            <div className="flex justify-between p-6">
              <div className="flex gap-2">
                <Button variant="outline" className="border-gray-800 gap-2">
                  <Star className="h-4 w-4" />
                  Save
                </Button>
                <Button
                  variant="outline"
                  className="border-gray-800 gap-2"
                  onClick={() => window.open(pitchDecks.find((deck) => deck.id === selectedDeck)?.url, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in New Tab
                </Button>
              </div>
              <Button
                className="bg-primary hover:bg-primary/90 text-black"
                onClick={() => window.open(pitchDecks.find((deck) => deck.id === selectedDeck)?.url, "_blank")}
              >
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
