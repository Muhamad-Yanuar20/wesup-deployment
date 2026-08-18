import React from 'react';
import {
    User,
    Mail,
    Phone,
    Briefcase,
    MapPin,
    Image as ImageIcon,
    UploadCloud,
    MapPinned,
    CheckCircle2
} from 'lucide-react';

export default function SupplierRegistrationPage() {
    return (
        <div className="min-h-screen bg-zinc-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl w-full mx-auto">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
                        Pendaftaran Pemasok
                    </h1>
                    <p className="mt-4 text-lg text-slate-600">
                        Bergabunglah sebagai mitra pemasok bahan baku UMKM di ekosistem Wesup.
                    </p>
                </div>

                <div className="bg-white py-10 px-6 shadow-sm border border-slate-100 rounded-3xl sm:px-12">
                    <form className="space-y-8">

                        {/* Nama Lengkap */}
                        <div>
                            <label htmlFor="fullName" className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                <User className="w-4 h-4 text-slate-400" />
                                Nama Lengkap
                            </label>
                            <input
                                type="text"
                                id="fullName"
                                name="fullName"
                                placeholder="Masukkan nama lengkap Anda"
                                className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 sm:text-sm shadow-sm outline-none transition-all"
                                required
                            />
                        </div>

                        {/* Email & WhatsApp (Grid 2 kolom) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                            <div>
                                <label htmlFor="email" className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                    <Mail className="w-4 h-4 text-slate-400" />
                                    Email
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    placeholder="alamat@email.com"
                                    className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 sm:text-sm shadow-sm outline-none transition-all"
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="whatsapp" className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                    <Phone className="w-4 h-4 text-slate-400" />
                                    Nomor WhatsApp
                                </label>
                                <input
                                    type="tel"
                                    id="whatsapp"
                                    name="whatsapp"
                                    placeholder="081234567890"
                                    className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 sm:text-sm shadow-sm outline-none transition-all"
                                    required
                                />
                            </div>
                        </div>

                        {/* Nama Usaha */}
                        <div>
                            <label htmlFor="businessName" className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                <Briefcase className="w-4 h-4 text-slate-400" />
                                Nama Usaha
                            </label>
                            <input
                                type="text"
                                id="businessName"
                                name="businessName"
                                placeholder="Contoh: PT. Sumber Pangan Jaya"
                                className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 sm:text-sm shadow-sm outline-none transition-all"
                                required
                            />
                        </div>

                        {/* Alamat Lengkap Teks */}
                        <div>
                            <label htmlFor="address" className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                <MapPin className="w-4 h-4 text-slate-400" />
                                Alamat Lengkap
                            </label>
                            <textarea
                                id="address"
                                name="address"
                                rows={3}
                                placeholder="Tuliskan alamat lengkap tempat usaha Anda beserta kode pos"
                                className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 sm:text-sm shadow-sm outline-none transition-all resize-y"
                                required
                            />
                        </div>

                        {/* Pin Map UI */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                <MapPinned className="w-4 h-4 text-slate-400" />
                                Titik Lokasi Peta (Pin Map)
                            </label>
                            <div className="mt-1 flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden relative h-56">
                                {/* Dummy Map Placeholder Visual */}
                                <div className="absolute inset-0 bg-[#f1f0ea] opacity-80">
                                    {/* Strip grid patterns for map dummy feel */}
                                    <div className="w-full h-full opacity-20" style={{ backgroundImage: 'linear-gradient(#ccc 1px, transparent 1px), linear-gradient(90deg, #ccc 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                                </div>

                                <div className="relative z-10 flex flex-col items-center">
                                    <div className="bg-white p-3 rounded-full shadow-md mb-4 ring-1 ring-slate-100">
                                        <MapPin className="h-7 w-7 text-red-500" />
                                    </div>
                                    <div className="text-center bg-white/95 backdrop-blur px-4 py-2 rounded-xl text-sm font-medium text-slate-700 shadow-sm border border-slate-200 mb-4">
                                        Koordinat: -6.2088, 106.8456 <span className="text-slate-400 font-normal ml-1">(Jakarta, dummy)</span>
                                    </div>
                                    <button type="button" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white border-2 border-slate-200 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all active:bg-slate-100">
                                        <MapPinned className="h-4 w-4 text-slate-500" />
                                        Pilih Titik Lokasi
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Media Upload UI */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                <ImageIcon className="w-4 h-4 text-slate-400" />
                                Foto Fisik Tempat Usaha
                            </label>
                            <div className="mt-1 flex justify-center rounded-2xl border-2 border-dashed border-slate-300 px-6 py-12 hover:border-blue-500 hover:bg-blue-50/50 transition-colors cursor-pointer group bg-zinc-50/50">
                                <div className="text-center">
                                    <UploadCloud className="mx-auto h-12 w-12 text-slate-300 group-hover:text-blue-500 transition-colors" aria-hidden="true" />
                                    <div className="mt-4 flex text-sm leading-6 text-slate-600 justify-center">
                                        <span className="relative rounded-md bg-transparent font-semibold text-blue-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2 hover:text-blue-500">
                                            <span>Unggah file</span>
                                        </span>
                                        <p className="pl-1">atau drag and drop</p>
                                    </div>
                                    <p className="text-xs leading-5 text-slate-500 mt-2 font-medium">
                                        Maksimal 10MB (Otomatis dikompresi ke .webp)
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="pt-6 mt-10 border-t border-slate-100">
                            <button
                                type="submit"
                                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-base font-semibold text-white shadow-sm hover:bg-blue-700 hover:shadow disabled:opacity-70 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all active:scale-[0.99]"
                            >
                                <CheckCircle2 className="w-5 h-5" />
                                Kirim Pendaftaran
                            </button>
                            <p className="text-center text-xs text-slate-500 mt-4 leading-relaxed font-medium">
                                Dengan mendaftar, Anda menyetujui <a href="#" className="font-semibold text-blue-600 hover:underline">Syarat & Ketentuan</a> serta <a href="#" className="font-semibold text-blue-600 hover:underline">Kebijakan Privasi</a> Wesup.
                            </p>
                        </div>

                    </form>
                </div>
            </div>
        </div>
    );
}
