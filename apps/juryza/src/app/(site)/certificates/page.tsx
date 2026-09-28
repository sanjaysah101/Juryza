"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ArrowRight, BadgeCheck, Fingerprint, ShieldCheck } from "lucide-react";

import { Button } from "@juryza/ui/components/ui/button";
import { Card, CardContent } from "@juryza/ui/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@juryza/ui/components/ui/field";
import { Input } from "@juryza/ui/components/ui/input";

/** Certificate lookup: enter a serial to verify a Juryza certificate. */

export default function CertificateLookupPage() {
  const router = useRouter();
  const [serial, setSerial] = useState("");
  const clean = serial.trim().toUpperCase();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8 px-4 py-20">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="bg-primary/10 text-primary ring-primary/15 grid size-14 place-items-center rounded-2xl ring-1">
          <BadgeCheck className="size-7" />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">Verify a certificate</h1>
        <p className="text-muted-foreground text-pretty">
          Every Juryza certificate carries a serial and a cryptographic signature. Enter the serial
          to check it's genuine and unaltered.
        </p>
      </div>
      <Card>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (clean) router.push(`/certificates/${encodeURIComponent(clean)}`);
            }}
          >
            <Field>
              <FieldLabel htmlFor="serial">Serial number</FieldLabel>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="serial"
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  placeholder="JZ-XXXXX-XXXXX"
                  className="font-mono uppercase"
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                />
                <Button type="submit" disabled={!clean}>
                  Verify <ArrowRight />
                </Button>
              </div>
              <FieldDescription>Printed at the bottom of the certificate.</FieldDescription>
            </Field>
          </form>
        </CardContent>
      </Card>
      <div className="text-muted-foreground grid gap-4 text-sm sm:grid-cols-2">
        <div className="flex gap-3">
          <Fingerprint className="text-primary mt-0.5 size-4 shrink-0" />
          <p>
            The signature is an HMAC-SHA256 over the certificate's contents, recomputed on every
            lookup.
          </p>
        </div>
        <div className="flex gap-3">
          <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" />
          <p>
            If any field was changed after issue, verification fails — no account needed to check.
          </p>
        </div>
      </div>
    </div>
  );
}
