import { serverApiFetch } from "./api/server.config";
import { Lexend } from "next/font/google";
import { fetchCurrentUserSSR } from "./api/auth.server";

// Components
import Header from "./components/common/Header";
import Footer from "./components/common/Footer";
import ToastProvider from "./components/providers/ToastProvider";
import { UserProvider } from "./components/providers/UserProvider";

// Styles
import "./globals.css";

const lexend = Lexend({ subsets: ["latin"] });

export const metadata = {
    title: "Parking Lot Management",
    description: "Modern parking lot management system",
};

export default async function RootLayout({ children }) {
    let initialUser = null;
    try {
        initialUser = await fetchCurrentUserSSR();
    } catch (e) {
        initialUser = null;
    }
    return (
        <html lang="en">
            <body className={`${lexend.className} antialiased min-h-screen flex flex-col`}>
                <UserProvider initialUser={initialUser}>
                    <ToastProvider />
                    <Header />
                    <div>{children}</div>
                    <Footer />
                </UserProvider>
            </body>
        </html>
    );
}
