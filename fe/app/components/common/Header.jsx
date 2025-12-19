"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { HiMenuAlt3, HiX } from "react-icons/hi";

const Header = () => {
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Don't render header on auth pages
    if (pathname?.startsWith("/login") || pathname?.startsWith("/admin") || pathname?.startsWith("/employee")) {
        return null;
    }

    return (
        <header className="bg-white shadow-sm sticky top-0 z-50">
            <nav className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                <div className="flex justify-between items-center">
                    <Link href="/" className="flex items-center space-x-2">
                        <span className="text-xl font-bold text-blue-600">Tunno Parking Lot</span>
                    </Link>
                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center space-x-6">
                        <Link href="/login" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                            Login
                        </Link>
                    </div>
                    {/* Mobile Menu Button */}
                    <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                        {isMenuOpen ? (
                            <HiX className="w-6 h-6 text-gray-600" />
                        ) : (
                            <HiMenuAlt3 className="w-6 h-6 text-gray-600" />
                        )}
                    </button>
                </div>

                {/* Mobile Navigation */}
                {isMenuOpen && (
                    <div className="md:hidden mt-4 pb-4 space-y-4">
                        <Link
                            href="/login"
                            className="block w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-center"
                        >
                            Login
                        </Link>
                    </div>
                )}
            </nav>
        </header>
    );
};

export default Header;
