"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
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
    <div className="space-y-8 p-4">
      <Card className="glass-card border-white/5 bg-white/[0.02] overflow-hidden rounded-[2.5rem] shadow-2xl">
        <CardHeader className="p-8 pb-4">
          <CardTitle className="text-3xl font-bold tracking-tight text-white mb-2">Venture Hall of Fame</CardTitle>
          <CardDescription className="text-white/40 text-base">
            Deconstruct the narratives that defined modern industry. Patterns of success, encoded in slides.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 pt-0">
          <div className="flex flex-col lg:flex-row gap-4 mb-8">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search the archives..."
                className="pl-12 bg-white/5 border-white/10 rounded-2xl h-14 text-lg focus:border-primary/50 transition-all placeholder:text-white/10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="border-white/10 rounded-2xl h-14 px-6 hover:bg-white/5 gap-2">
                <Filter className="h-5 w-5" />
                Filter
              </Button>
              <div className="relative">
                <Button
                  variant="outline"
                  className="border-white/10 rounded-2xl h-14 px-6 hover:bg-white/5 gap-2"
                  onClick={() => setShowSortMenu(!showSortMenu)}
                >
                  <ArrowUpDown className="h-5 w-5" />
                  Sort
                </Button>
                <AnimatePresence>
                  {showSortMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-3 w-56 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-20 overflow-hidden"
                    >
                      <div className="p-2">
                        {["featured", "rating", "recent", "name"].map((option) => (
                          <button
                            key={option}
                            className="w-full text-left px-4 py-3 text-sm rounded-xl hover:bg-white/5 transition-colors capitalize text-white/70 hover:text-white"
                            onClick={() => {
                              setSortBy(option)
                              setShowSortMenu(false)
                            }}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex bg-white/5 border border-white/10 rounded-2xl h-auto p-1.5 mb-8 w-fit">
              {["all", "featured", "seed", "series"].map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="py-3 px-6 data-[state=active]:bg-primary data-[state=active]:text-black rounded-xl transition-all duration-300 font-bold capitalize"
                >
                  {tab === "all" ? "All Narratives" : tab === "series" ? "Series A+" : tab}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={activeTab} className="mt-0 ring-0 outline-none">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab + searchTerm + sortBy}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                >
                  {sortedDecks.length > 0 ? (
                    sortedDecks.map((deck) => (
                      <motion.div
                        key={deck.id}
                        whileHover={{ y: -10 }}
                        className="glass-card border-white/10 overflow-hidden rounded-3xl group cursor-pointer bg-white/[0.02] hover:border-primary/30 transition-all duration-500"
                        onClick={() => setSelectedDeck(deck.id)}
                      >
                        <div className="relative h-56 overflow-hidden">
                          <img
                            src={deck.thumbnail || "/placeholder.svg"}
                            alt={`${deck.name} Pitch Deck`}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60" />
                          {deck.featured && (
                            <div className="absolute top-4 right-4 bg-primary text-black text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg">
                              Legendary
                            </div>
                          )}
                          <div className="absolute bottom-4 left-4">
                            <div className="text-xs font-bold text-primary uppercase tracking-widest mb-1">{deck.industry}</div>
                            <h3 className="text-xl font-bold text-white tracking-tight">{deck.name}</h3>
                          </div>
                        </div>
                        <CardContent className="p-6">
                          <p className="text-sm text-white/40 mb-6 line-clamp-2 leading-relaxed">{deck.description}</p>
                          <div className="flex flex-wrap gap-3 mb-6">
                            <div className="flex items-center text-[10px] font-bold uppercase tracking-widest bg-white/5 border border-white/5 px-3 py-1.5 rounded-full text-white/60">
                              <DollarSign className="h-3 w-3 mr-1 text-primary" />
                              {deck.amount}
                            </div>
                            <div className="flex items-center text-[10px] font-bold uppercase tracking-widest bg-white/5 border border-white/5 px-3 py-1.5 rounded-full text-white/60">
                              <Calendar className="h-3 w-3 mr-1 text-primary" />
                              {deck.year}
                            </div>
                            <div className="flex items-center text-[10px] font-bold uppercase tracking-widest bg-white/5 border border-white/5 px-3 py-1.5 rounded-full text-white/60">
                              <Tag className="h-3 w-3 mr-1 text-primary" />
                              {deck.stage}
                            </div>
                          </div>
                          <div className="flex justify-between items-center pt-4 border-t border-white/5">
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 text-primary fill-primary" />
                              <span className="text-xs font-bold text-white">{deck.rating}</span>
                            </div>
                            <Button variant="ghost" size="sm" className="h-10 w-10 rounded-xl hover:bg-primary hover:text-black transition-colors">
                              <ExternalLink className="h-5 w-5" />
                            </Button>
                          </div>
                        </CardContent>
                      </motion.div>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-20 bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
                      <p className="text-white/20 text-lg">No records match your current query.</p>
                      <Button variant="link" className="text-primary mt-2" onClick={() => setSearchTerm("")}>Clear Filters</Button>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {selectedDeck && (
        <Card className="glass-card border-white/10 bg-black/90 backdrop-blur-3xl p-8 rounded-[2.5rem] shadow-3xl">
          <CardHeader className="flex flex-row justify-between items-start p-0 mb-8">
            <div>
              <CardTitle className="text-3xl font-bold text-white mb-2">{pitchDecks.find((deck) => deck.id === selectedDeck)?.name} Pitch Deck</CardTitle>
              <CardDescription className="text-white/40 text-lg">{pitchDecks.find((deck) => deck.id === selectedDeck)?.description}</CardDescription>
            </div>
            <Button variant="outline" className="border-white/10 rounded-xl px-6" onClick={() => setSelectedDeck(null)}>
              Close
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="aspect-[16/9] w-full bg-black/50 rounded-2xl overflow-hidden border border-white/10 shadow-inner">
              <iframe
                src={pitchDecks.find((deck) => deck.id === selectedDeck)?.url}
                className="w-full h-full"
                title={`${pitchDecks.find((deck) => deck.id === selectedDeck)?.name} Pitch Deck`}
              />
            </div>

            <div className="flex justify-between mt-8">
              <div className="flex gap-3">
                <Button variant="outline" className="border-white/10 rounded-xl px-6 gap-2">
                  <Star className="h-4 w-4" />
                  Save to Vault
                </Button>
                <Button
                  variant="outline"
                  className="border-white/10 rounded-xl px-6 gap-2"
                  onClick={() => window.open(pitchDecks.find((deck) => deck.id === selectedDeck)?.url, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                  Deep Analysis
                </Button>
              </div>
              <Button
                className="bg-primary hover:bg-primary/90 text-black font-bold rounded-xl px-10 shadow-[0_0_20px_rgba(39,174,96,0.3)]"
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
