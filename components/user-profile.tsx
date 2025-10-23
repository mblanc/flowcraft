'use client'

import { ChevronDown, LogOut } from 'lucide-react';
import type { Session } from 'next-auth'; // Import Session type
import { signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import { useEffect, useState } from 'react';

// Combined User type to handle both sources
interface CombinedUser {
    email?: string | null;
    name?: string | null;
    picture?: string | null; // From IAP
    image?: string | null;   // From Auth.js session
}

export function UserProfile({ isCollapsed }: { isCollapsed: boolean }) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const { data: session, status }: { data: Session | null; status: "loading" | "authenticated" | "unauthenticated" } = useSession();
    const authJsUser = session?.user; // User object from Auth.js session
    const isAuthJsLoading = status === 'loading';

    // --- Determine User and Loading State ---
    const user: CombinedUser | null | undefined = authJsUser;
    const effectiveIsLoading = isAuthJsLoading;

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            if (!target.closest('.user-profile-dropdown')) {
                setIsDropdownOpen(false);
            }
        };

        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDropdownOpen]);

    // --- Render Logic ---
    if (effectiveIsLoading) {
        return <div className="h-8 w-32 bg-gray-300 rounded animate-pulse"></div>;
    }


    // --- Auth.js Mode Rendering ---
    if (!user) { // Not authenticated via Auth.js
        return null;
    }

    // Authenticated via Auth.js
    const displayName = user.name;
    const displayPicture = user.image; // Auth.js session uses image

    const handleSignOut = async () => {
        setIsDropdownOpen(false);
        await signOut({ callbackUrl: '/' });
    };

    // console.log(user)

    return (
        <div className="relative user-profile-dropdown">
            <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
                {displayPicture ? (
                    <Image
                        src={displayPicture}
                        alt={displayName || 'User profile'}
                        width={24}
                        height={24}
                        className="rounded-full"
                    />
                ) : (
                    <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center text-white text-xs">
                        {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
                    </div>
                )}
                {!isCollapsed && (
                    <>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                            {displayName}
                        </span>
                        <ChevronDown 
                            size={16} 
                            className={`text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
                        />
                    </>
                )}
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                    <div className="py-1">
                        {/* User Info */}
                        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {displayName}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {user.email}
                            </div>
                        </div>
                        
                        {/* Sign Out Option */}
                        <button
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <LogOut size={16} />
                            Sign Out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
} 