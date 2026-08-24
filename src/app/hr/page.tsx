'use client'

import React, { useState, useEffect, useMemo } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  Users,
  Plus,
  UserCheck,
  Shield,
  Mail,
  Phone,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  UserPlus,
  Power,
} from 'lucide-react'

interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'employee'
  is_active: boolean
  created_at: string
}

export default function HRPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'employee' as 'admin' | 'employee',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      if (Array.isArray(data)) {
        setUsers(data)
      }
    } catch (err) {
      console.error('Failed to load users:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create employee')
      }

      setSuccess('Employee created successfully!')
      setFormData({ name: '', email: '', password: '', role: 'employee' })
      setShowAddModal(false)
      fetchUsers()
    } catch (err: any) {
      setError(err.message || 'Failed to create employee')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to delete employee "${userName}"? This cannot be undone.`)) {
      return
    }

    try {
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user')
      }

      setSuccess('Employee deleted successfully')
      fetchUsers()
    } catch (err: any) {
      setError(err.message || 'Failed to delete employee')
    }
  }

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, is_active: !currentStatus }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update status')
      }

      fetchUsers()
    } catch (err: any) {
      setError(err.message || 'Failed to update employee status')
    }
  }

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users
    const q = searchQuery.toLowerCase()
    return users.filter(
      (u) =>
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.role && u.role.toLowerCase().includes(q))
    )
  }, [users, searchQuery])

  const employeeCount = users.filter((u) => u.role === 'employee').length
  const adminCount = users.filter((u) => u.role === 'admin').length
  const activeCount = users.filter((u) => u.is_active !== false).length

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header Bar */}
        <div className="flex items-center justify-between flex-wrap gap-4 bg-white dark:bg-gray-950 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center font-bold">
                <Users className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">HR & Team Operations</h1>
            </div>
            <p className="text-xs text-gray-500">Create, manage, and assign employee access and permissions</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchUsers()}
              className="p-2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-gray-600 dark:text-gray-400 transition-colors"
              title="Refresh Team List"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => {
                setError('')
                setSuccess('')
                setShowAddModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create New Employee</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">Total Team</span>
              <span className="p-1.5 bg-blue-50 dark:bg-blue-950 text-blue-600 rounded-lg">
                <Users className="w-4 h-4" />
              </span>
            </div>
            <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">{users.length}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{activeCount} active currently</p>
          </div>

          <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">Employees (Seats)</span>
              <span className="p-1.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-lg">
                <UserCheck className="w-4 h-4" />
              </span>
            </div>
            <p className="text-2xl font-black text-emerald-600 mt-2">{employeeCount} / 3</p>
            <p className="text-[11px] text-gray-400 mt-0.5">3 employee seats in plan</p>
          </div>

          <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">Administrators</span>
              <span className="p-1.5 bg-purple-50 dark:bg-purple-950 text-purple-600 rounded-lg">
                <Shield className="w-4 h-4" />
              </span>
            </div>
            <p className="text-2xl font-black text-purple-600 mt-2">{adminCount}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Full control & setup</p>
          </div>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {success && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
            <button onClick={() => setSuccess('')} className="text-emerald-500 hover:text-emerald-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Team Members List */}
        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-gray-900 dark:text-white">Team Members</span>
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-bold text-gray-600 dark:text-gray-300">
                {filteredUsers.length}
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52 sm:w-64"
              />
            </div>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
            {loading ? (
              <div className="py-16 text-center text-gray-400">
                <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-indigo-500" />
                <p className="font-semibold">Loading team members...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="font-semibold">No team members found</p>
              </div>
            ) : (
              filteredUsers.map((u) => (
                <div
                  key={u.id}
                  className="p-4 flex items-center justify-between hover:bg-gray-50/70 dark:hover:bg-gray-900/60 transition-colors flex-wrap gap-3"
                >
                  <div className="flex items-center gap-3.5 min-w-[200px]">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                      {u.name?.slice(0, 2).toUpperCase() || 'EM'}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>{u.name || 'Unnamed Employee'}</span>
                        {u.is_active === false && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-gray-100 text-gray-500 border border-gray-200">
                            Deactivated
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3 h-3 text-gray-400" />
                        <span>{u.email}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                        u.role === 'admin'
                          ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                          : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                      }`}
                    >
                      {u.role === 'admin' ? '🛡️ Administrator' : '👤 Employee'}
                    </span>

                    {/* Status Toggle (For Employees) */}
                    {u.role === 'employee' && (
                      <button
                        onClick={() => handleToggleActive(u.id, u.is_active !== false)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[10px] transition-colors border ${
                          u.is_active !== false
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-200'
                        }`}
                        title={u.is_active !== false ? 'Click to deactivate access' : 'Click to activate access'}
                      >
                        <Power className="w-3 h-3" />
                        <span>{u.is_active !== false ? 'Active' : 'Inactive'}</span>
                      </button>
                    )}

                    {/* Delete Employee Button */}
                    <button
                      onClick={() => handleDeleteUser(u.id, u.name)}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl transition-colors"
                      title="Delete this employee"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Create Employee Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">Create New Employee</h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              <form onSubmit={handleAddUser} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="rahul@shreemahalaxmi.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Password (min 6 characters) *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="Enter strong password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full p-2.5 pr-9 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Role / Access Level</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'employee' })}
                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="employee">Employee (CRM Access & Follow-ups)</option>
                    <option value="admin">Administrator (Full System Control)</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>Create Account</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
