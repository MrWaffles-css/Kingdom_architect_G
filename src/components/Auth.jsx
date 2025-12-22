import React, { useState } from 'react'
import { supabase } from '../supabase'
import logo from '../assets/logo.png'

export default function Auth({ onLogin, mode = 'login' }) {
    const [isRegistering, setIsRegistering] = useState(mode === 'register')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [username, setUsername] = useState('')
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        setLoading(false)
        if (error) setMessage(error.message)
        else onLogin(data.user)
    }

    const handleRegister = async (e) => {
        e.preventDefault()
        setLoading(true)
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username
                }
            }
        })
        setLoading(false)

        if (error) setMessage(error.message)
        else setMessage('Account created! You can now login.')
    }

    return (
        <div className="w-full bg-[#c0c0c0] font-sans text-xs">

            <div className="p-3">
                <div className="text-center mb-6 mt-2 flex flex-col items-center">
                    <img src={logo} alt="Kingdom Architect" className="w-48 h-auto mb-3 pixelated" />
                    <p className="max-w-[280px] font-bold text-sm">Build your kingdom, train your army, and conquer the realm!</p>
                </div>

                <div className="flex justify-center gap-4 mb-4">
                    <div className="flex items-center gap-1">
                        <input
                            id="login-radio"
                            type="radio"
                            name="auth-mode"
                            checked={!isRegistering}
                            onChange={() => { setIsRegistering(false); setMessage('') }}
                            className="bg-white border-2 border-gray-600 border-r-white border-b-white rounded-full w-3 h-3 appearance-none checked:bg-black checked:border-4 checked:border-white ring-1 ring-gray-400"
                            style={{ appearance: 'radio' }}
                        />
                        <label htmlFor="login-radio">Login</label>
                    </div>
                    <div className="flex items-center gap-1">
                        <input
                            id="register-radio"
                            type="radio"
                            name="auth-mode"
                            checked={isRegistering}
                            onChange={() => { setIsRegistering(true); setMessage('') }}
                            className="bg-white border-2 border-gray-600 border-r-white border-b-white rounded-full w-3 h-3 appearance-none checked:bg-black checked:border-4 checked:border-white ring-1 ring-gray-400"
                            style={{ appearance: 'radio' }}
                        />
                        <label htmlFor="register-radio">Register</label>
                    </div>
                </div>

                <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-3">
                    {isRegistering && (
                        <div className="flex items-center">
                            <label htmlFor="username" className="w-20 text-right pr-2">Username:</label>
                            <input
                                id="username"
                                type="text"
                                className="flex-1 bg-white border-2 border-gray-600 border-r-white border-b-white px-1 py-0.5 outline-none focus:bg-yellow-50"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                required
                            />
                        </div>
                    )}
                    <div className="flex items-center">
                        <label htmlFor="email" className="w-20 text-right pr-2">Email:</label>
                        <input
                            id="email"
                            type="email"
                            className="flex-1 bg-white border-2 border-gray-600 border-r-white border-b-white px-1 py-0.5 outline-none focus:bg-yellow-50"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="flex items-center">
                        <label htmlFor="password" className="w-20 text-right pr-2">Password:</label>
                        <input
                            id="password"
                            type="password"
                            className="flex-1 bg-white border-2 border-gray-600 border-r-white border-b-white px-1 py-0.5 outline-none focus:bg-yellow-50"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <div className="flex justify-end mt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-1 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white outline-dotted outline-1 outline-offset-[-4px] outline-black"
                        >
                            {loading ? 'Processing...' : (isRegistering ? 'Register' : 'OK')}
                        </button>
                    </div>
                </form>

                {message && (
                    <div className="mt-4 border border-gray-400 p-1 bg-gray-100">
                        <p className="text-red-800">{message}</p>
                    </div>
                )}
            </div>
        </div>
    )
}
