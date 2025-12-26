export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Parking Status - Digital Signage</title>
      </head>
      <body className="overflow-hidden">{children}</body>
    </html>
  )
}
