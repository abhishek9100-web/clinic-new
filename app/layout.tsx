import "./globals.css";

export const metadata = {
  title: "New Life Care",
  description: "Hospital Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Just render the children here. No sidebar! */}
        {children}
      </body>
    </html>
  );
}