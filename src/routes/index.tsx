import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Banknote,
  Bot,
  Check,
  MapPin,
  Pencil,
  QrCode,
  ShieldCheck,
  Smartphone,
  Star,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "DigiToCash — Autonomous P2P Liquidity Agent" },
      {
        name: "description",
        content:
          "Match cash and UPI swaps peer-to-peer with an autonomous liquidity agent. Broadcast, score, match, verify — done in seconds.",
      },
      { property: "og:title", content: "DigiToCash — Autonomous P2P Liquidity Agent" },
      {
        property: "og:description",
        content:
          "Match cash and UPI swaps peer-to-peer with an autonomous liquidity agent. Broadcast, score, match, verify — done in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Direction = "cash2upi" | "upi2cash";
type Phase = "idle" | "matching" | "matched";

type Profile = {
  name: string;
  location: string;
  cash: number;
  upi: number;
};

type ProfileForm = {
  name: string;
  location: string;
  cash: string;
  upi: string;
};

const STORAGE_KEY = "digitocash-profile";

const TERMINAL_LINES = [
  "$ digitocash agent run --subnet in-mum-01",
  "Broadcasting to subnet...",
  "Scoring peers by distance, rating & liquidity...",
  "Peer matched!",
];

const QUICK_AMOUNTS = [500, 1000, 2000];

const PEER = {
  id: 892,
  rating: 4.9,
  distance: "400m away",
  location: "Central Cafe",
};

function formatINR(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function toDigits(value: string) {
  return value.replace(/[^0-9]/g, "").slice(0, 7);
}

/** Deterministic mock QR code (decorative only). */
function MockQr() {
  const n = 21;
  const cells = useMemo(() => {
    const grid = new Array<boolean>(n * n).fill(false);
    let seed = 892;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < grid.length; i++) grid[i] = rand() > 0.52;
    const finder = (ox: number, oy: number) => {
      for (let y = -1; y < 8; y++) {
        for (let x = -1; x < 8; x++) {
          const px = ox + x;
          const py = oy + y;
          if (px < 0 || py < 0 || px >= n || py >= n) continue;
          if (x === -1 || x === 7 || y === -1 || y === 7) {
            grid[py * n + px] = false;
          } else {
            grid[py * n + px] = x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4);
          }
        }
      }
    };
    finder(0, 0);
    finder(n - 7, 0);
    finder(0, n - 7);
    return grid;
  }, []);

  return (
    <svg viewBox={`0 0 ${n} ${n}`} className="h-40 w-40" role="img" aria-label="Mock verification QR code">
      <rect width={n} height={n} rx="1.5" fill="var(--card)" />
      {cells.map((on, i) =>
        on ? (
          <rect key={i} x={i % n} y={Math.floor(i / n)} width="1" height="1" fill="var(--primary)" />
        ) : null,
      )}
    </svg>
  );
}

function ProfileFields({ form, setForm }: { form: ProfileForm; setForm: (f: ProfileForm) => void }) {
  const field = (key: keyof ProfileForm) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: key === "name" || key === "location" ? e.target.value : toDigits(e.target.value) }),
  });

  return (
    <div className="grid gap-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</label>
        <Input {...field("name")} placeholder="Your name" />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Location
        </label>
        <Input {...field("location")} placeholder="e.g. Indore" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-cash">
            Starting Cash (₹)
          </label>
          <Input {...field("cash")} inputMode="numeric" placeholder="2500" className="font-mono" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-upi">Starting UPI (₹)</label>
          <Input {...field("upi")} inputMode="numeric" placeholder="4000" className="font-mono" />
        </div>
      </div>
    </div>
  );
}

function Index() {
  // undefined = still checking saved profile; null = no profile yet (onboarding)
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<ProfileForm>({ name: "", location: "", cash: "", upi: "" });

  const [direction, setDirection] = useState<Direction>("cash2upi");
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [visibleLines, setVisibleLines] = useState(0);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [pin, setPin] = useState("0000");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setProfile(JSON.parse(raw) as Profile);
      } else {
        setProfile(null);
        setOnboardingOpen(true);
      }
    } catch {
      setProfile(null);
      setOnboardingOpen(true);
    }
  }, []);

  const amountNum = Number(amount) || 0;
  const matching = phase === "matching";
  const cash = profile?.cash ?? 0;
  const upi = profile?.upi ?? 0;

  const initials = useMemo(
    () =>
      (profile?.name ?? "")
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    [profile?.name],
  );

  useEffect(() => {
    if (phase !== "matching") return;
    setVisibleLines(0);
    const timers = [
      setTimeout(() => setVisibleLines(1), 250),
      setTimeout(() => setVisibleLines(2), 900),
      setTimeout(() => setVisibleLines(3), 1550),
      setTimeout(() => setVisibleLines(4), 2050),
      setTimeout(() => setPhase("matched"), 2300),
    ];
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  const submitProfile = (isEdit: boolean) => {
    const name = form.name.trim();
    if (!name) {
      toast.error("Enter your name to continue");
      return;
    }
    const saved: Profile = {
      name,
      location: form.location.trim() || "Unknown location",
      cash: Number(form.cash) || 0,
      upi: Number(form.upi) || 0,
    };
    setProfile(saved);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // storage unavailable — profile just lives for this session
    }
    setOnboardingOpen(false);
    setEditOpen(false);
    if (isEdit) {
      toast.success("Profile updated", { description: `${saved.name} · ${saved.location}` });
    } else {
      toast.success(`Welcome, ${saved.name}!`, { description: `Agent ready in ${saved.location}` });
    }
  };

  const openEdit = () => {
    if (!profile) return;
    setForm({
      name: profile.name,
      location: profile.location,
      cash: String(profile.cash),
      upi: String(profile.upi),
    });
    setEditOpen(true);
  };

  const activateAgent = () => {
    if (amountNum <= 0) {
      toast.error("Enter an amount first");
      return;
    }
    setPhase("matching");
  };

  const openVerification = () => {
    setPin(String(Math.floor(1000 + Math.random() * 9000)));
    setVerifyOpen(true);
  };

  const resetFlow = () => {
    setPhase("idle");
    setVisibleLines(0);
    setAmount("");
  };

  const confirmTransfer = () => {
    toast.success("Transfer complete", {
      description:
        direction === "cash2upi"
          ? `${formatINR(amountNum)} UPI received from Peer #${PEER.id}. Cash handed over.`
          : `${formatINR(amountNum)} cash received from Peer #${PEER.id}. UPI sent.`,
    });
    setVerifyOpen(false);
    resetFlow();
  };

  const dirLabel = direction === "cash2upi" ? "Have Cash → Need UPI" : "Have UPI → Need Cash";
  const toggleClass = (active: boolean) =>
    `flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors sm:text-sm ${
      active ? "btn-gradient glow-sm" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-border/60">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="glow-sm flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">DigiToCash</h1>
              <p className="text-xs text-muted-foreground">Autonomous P2P Liquidity Agent</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
            </span>
            <span className="rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
              Agent Active
            </span>
          </div>
        </div>

        {/* User profile strip */}
        {profile && (
          <div className="mx-auto w-full max-w-2xl px-4 pb-3">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="btn-gradient glow-sm flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                {initials || "…"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">{profile.name}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  {profile.location}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={openEdit}
                aria-label="Edit profile and balances"
                className="text-muted-foreground hover:text-primary"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="mx-auto grid w-full max-w-2xl grid-cols-2 gap-3 px-4 pb-5">
          <div className="glow-cash flex items-center gap-3 rounded-xl border border-cash/25 bg-card px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cash/15 text-cash">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-cash/80">Cash</p>
              <p className="text-sm font-semibold text-cash">{formatINR(cash)}</p>
            </div>
          </div>
          <div className="glow-upi flex items-center gap-3 rounded-xl border border-upi/30 bg-card px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-upi/15 text-upi">
              <Smartphone className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-upi/80">UPI</p>
              <p className="text-sm font-semibold text-upi">{formatINR(upi)}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        {/* Swap card */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Create a Swap</h2>
            <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
              {dirLabel}
            </span>
          </div>

          {/* Direction toggle */}
          <div
            className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/50 p-1"
            role="group"
            aria-label="Swap direction"
          >
            <button type="button" onClick={() => setDirection("cash2upi")} aria-pressed={direction === "cash2upi"} className={toggleClass(direction === "cash2upi")}>
              <Banknote className="h-4 w-4 shrink-0" />
              Have Cash → Need UPI
            </button>
            <button type="button" onClick={() => setDirection("upi2cash")} aria-pressed={direction === "upi2cash"} className={toggleClass(direction === "upi2cash")}>
              <Smartphone className="h-4 w-4 shrink-0" />
              Have UPI → Need Cash
            </button>
          </div>

          {/* Amount */}
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Amount
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">
              ₹
            </span>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="0"
              disabled={matching}
              className="h-14 bg-background pl-9 text-2xl font-semibold tracking-wide"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map((value) => (
              <Button
                key={value}
                type="button"
                variant="outline"
                size="sm"
                disabled={matching}
                onClick={() => setAmount(String(value))}
                className="font-mono"
              >
                ₹{value.toLocaleString("en-IN")}
              </Button>
            ))}
          </div>

          <Button type="button" size="lg" disabled={matching} onClick={activateAgent} className="btn-gradient glow mt-5 w-full text-base font-semibold">
            <Bot className="mr-2 h-5 w-5" />
            {matching ? "Agent working…" : "Activate Agent"}
          </Button>
        </section>

        {/* Terminal console */}
        {phase === "matching" && (
          <section className="terminal-shadow mt-5 animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-primary/30 bg-background/80 p-4 font-mono text-[13px] leading-relaxed duration-300">
            <div className="mb-3 flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-cash/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-upi/70" />
              <span className="ml-2 text-[11px] text-muted-foreground">agent-terminal</span>
            </div>
            {TERMINAL_LINES.slice(0, visibleLines).map((line, i) => (
              <p
                key={line}
                className={i === TERMINAL_LINES.length - 1 ? "font-semibold text-cash" : "text-primary/90"}
              >
                <span className="animate-in fade-in duration-200">{line}</span>
              </p>
            ))}
            <span className="inline-block h-4 w-2 animate-pulse bg-primary align-middle" />
          </section>
        )}

        {/* Matched peer card */}
        {phase === "matched" && (
          <section className="glow mt-5 animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-primary/40 bg-card p-5 duration-300 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="rounded-full border border-cash/30 bg-cash/10 px-3 py-1 text-xs font-semibold text-cash">
                Peer matched
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {formatINR(amountNum)} · {dirLabel}
              </span>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Bot className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">Peer ID #{PEER.id}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <Star className="h-4 w-4 fill-upi text-upi" />
                    {PEER.rating}★
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-primary" />
                    {PEER.distance} ({PEER.location})
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {direction === "cash2upi"
                    ? "Peer will send you UPI; hand over cash in person."
                    : "Peer will hand over cash; send UPI on confirmation."}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button type="button" size="lg" onClick={openVerification} className="btn-gradient glow-sm flex-1 font-semibold">
                <Check className="mr-2 h-5 w-5" />
                Accept Swap
              </Button>
              <Button type="button" size="lg" variant="outline" onClick={resetFlow} className="sm:w-32">
                Decline
              </Button>
            </div>
          </section>
        )}

        {phase === "idle" && (
          <p className="mt-5 text-center text-xs text-muted-foreground">
            Set your amount and activate the agent — it finds, scores and matches a peer near you.
          </p>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 py-5">
        <p className="text-center text-xs text-muted-foreground">Made by Rudraksh Goyal</p>
      </footer>

      {/* Onboarding modal (first time only — cannot be dismissed) */}
      <Dialog open={onboardingOpen}>
        <DialogContent
          className="max-w-sm rounded-2xl border-border bg-card sm:max-w-sm"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Welcome to DigiToCash
            </DialogTitle>
            <DialogDescription>
              Set up your profile and starting balances — the agent uses these to match peers for you.
            </DialogDescription>
          </DialogHeader>
          <ProfileFields form={form} setForm={setForm} />
          <Button type="button" size="lg" onClick={() => submitProfile(false)} className="btn-gradient glow-sm w-full font-semibold">
            <Zap className="mr-2 h-5 w-5" />
            Start Agent
          </Button>
        </DialogContent>
      </Dialog>

      {/* Edit profile modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm rounded-2xl border-border bg-card sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Edit Profile &amp; Balances
            </DialogTitle>
            <DialogDescription>Update your details and balances anytime.</DialogDescription>
          </DialogHeader>
          <ProfileFields form={form} setForm={setForm} />
          <Button type="button" size="lg" onClick={() => submitProfile(true)} className="btn-gradient glow-sm w-full font-semibold">
            <Check className="mr-2 h-5 w-5" />
            Save Changes
          </Button>
        </DialogContent>
      </Dialog>

      {/* Verification modal */}
      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="max-w-sm rounded-2xl border-border bg-card sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Verify &amp; Complete Swap
            </DialogTitle>
            <DialogDescription>
              Show this QR to Peer #{PEER.id} and read out the PIN to confirm both sides.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-5">
            <div className="rounded-xl border border-border bg-background p-3">
              <MockQr />
            </div>

            <div>
              <p className="mb-2 text-center text-xs uppercase tracking-wide text-muted-foreground">Verification PIN</p>
              <div className="flex justify-center gap-2" aria-label={`PIN ${pin}`}>
                {pin.split("").map((digit, i) => (
                  <span
                    key={i}
                    className="glow-sm flex h-12 w-11 items-center justify-center rounded-lg border border-primary/40 bg-background font-mono text-xl font-semibold text-primary"
                  >
                    {digit}
                  </span>
                ))}
              </div>
            </div>

            <Button type="button" size="lg" onClick={confirmTransfer} className="btn-gradient glow w-full font-semibold">
              <Check className="mr-2 h-5 w-5" />
              Confirm Transfer Complete
            </Button>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <QrCode className="h-3.5 w-3.5" />
              Escrow released automatically after both parties confirm.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
