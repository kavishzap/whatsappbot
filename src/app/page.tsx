'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    router.push('/dashboard/whatsapp-bot')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100" style={{ backgroundImage: 'radial-gradient(circle, #c0c0c0 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl mx-4 overflow-hidden flex min-h-[540px]">

        {/* Left — form */}
        <div className="flex-1 px-12 py-14 flex flex-col justify-center">
          <div className="mb-6">
            <Image
              src="/_C9BFF9E0-617F-45DD-91B5-57549414608C_-removebg-preview.png"
              alt="Spark Distributors"
              width={180}
              height={80}
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-1">LOGIN</h1>
          <p className="text-sm text-gray-400 mb-8">Sign in to manage your WhatsApp bot dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-violet-500 hover:bg-violet-600 active:bg-violet-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm mt-1"
            >
              Login Now
            </button>
          </form>

        </div>

        {/* Right — image panel */}
        <div className="hidden md:flex w-[45%] bg-gradient-to-br from-violet-400 to-indigo-600 items-center justify-center p-10 relative overflow-hidden">
          {/* Background blobs */}
          <div className="absolute top-6 right-6 w-28 h-28 bg-white/10 rounded-full" />
          <div className="absolute bottom-10 left-4 w-20 h-20 bg-white/10 rounded-full" />

          {/* Card with image */}
          <div className="relative bg-white/20 backdrop-blur-sm rounded-3xl p-4 shadow-xl">
            <Image
              src="/ChatGPT Image Jun 4, 2026, 12_13_52 AM.png"
              alt="WhatsApp Bot"
              width={320}
              height={320}
              className="rounded-2xl object-contain"
              priority
            />
          </div>
        </div>

      </div>
    </main>
  )
}
