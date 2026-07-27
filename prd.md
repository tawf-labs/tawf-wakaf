SWR (Staking Waqf Ritel) adalah inovasi platform Decentralized Finance (DeFi) yang memadukan instrumen Keuangan Sosial Islam dengan mekanisme Liquid Staking. Terinspirasi dari model Sukuk Waqf Ritel (SWR) konvensional, platform ini memungkinkan pengguna (Wakif) untuk melakukan wakaf uang tanpa kehilangan modal utamanya. Pengguna menyetorkan aset (misalnya stablecoin IDRX), yang kemudian dikelola melalui mekanisme smart contract untuk di-stake ke berbagai portofolio liquid staking (seperti TRX, ETH) guna mendiversifikasi risiko volatilitas. Keuntungan (yield) dari hasil staking tersebut secara otomatis dipisahkan menggunakan model perhitungan Net Asset Value (NAV) dan disalurkan kepada lembaga Nadzir sebagai dana wakaf. Sementara itu, nilai pokok (principal) pengguna tetap utuh dan baru dapat ditarik setelah masa tenor pool tercapai (berkisar antara 30 hingga 180 hari), ditambah dengan waktu tunggu pencairan (unbonding period) sekitar 14 hari.
Tujuan & Sasaran
Memfasilitasi Wakaf Tanpa Risiko Pokok: Memberikan instrumen kepada masyarakat ritel untuk berwakaf dengan modal yang dipertahankan penuh (100% principal preservation).
Mitigasi Risiko Volatilitas: Menggunakan pendekatan portofolio (basket staking) ke berbagai protokol sharia-compliant untuk meminimalisir risiko penurunan nilai aset tunggal.
Otomatisasi Penyaluran Wakaf: Membangun infrastruktur penyaluran yield secara transparan dan on-chain langsung ke dompet lembaga Nadzir.
Arsitektur & Strategi Diversifikasi SWR
Pendekatan Multi-Pool (Basket Staking): Untuk menjawab tantangan volatilitas jika hanya bergantung pada satu aset kripto, SWR mengimplementasikan Vault Contract yang mendistribusikan deposit IDRX ke beberapa protokol. Alih-alih mempertaruhkan semua dana ke satu jenis koin, sistem akan memecah deposit ke beberapa tempat staking. Misalnya:
40% ke LST berbasis ETH yang di-whitelist.
30% ke TRX.
30% ke aset berbasis Real World Asset (RWA) syariah.
Jika satu aset mengalami koreksi nilai, aset lain dalam portofolio dapat menyeimbangkan, memastikan stabilitas model NAV agar pokok pengguna tetap aman.
Alur Pengguna (User Flow)

Deposit & Lock: Pengguna menyetorkan IDRX dan memilih/menyetujui periode tenor staking (misal: 30, 90, atau 180 hari).
Minting & Routing: Sistem mencetak token wqIDRX sebagai bukti kepemilikan dan menyebar aset ke berbagai staking pools.
Automated Yield Stripping: Selama masa tenor, selisih keuntungan (NAV) secara berkala dipotong oleh smart contract dan dikirimkan ke dompet Nadzir.
Maturity & Unbonding Request: Setelah masa tenor (30-180 hari) selesai, pengguna menekan tombol Request Withdraw. Sistem akan memulai masa tunggu (unbonding period) selama kurang lebih 14 hari.
Claim Principal: Setelah masa unbonding 14 hari selesai, pengguna dapat mengklaim kembali IDRX modal awal mereka 100% tanpa potongan.
Spesifikasi Fungsional (Functional Requirements)
Fitur
Deskripsi
Prioritas
Smart Vault Router
Smart contract yang menerima deposit dan merutekan dana ke berbagai pool staking secara proporsional.
Tinggi (P0)
NAV Oracle Integration
Sistem pembacaan data on-chain untuk menghitung Net Asset Value dari seluruh aset secara real-time.
Tinggi (P0)
Automated Yield Stripper
Fungsi yang memisahkan profit dari pokok berdasarkan NAV dan mengirimkannya ke Nadzir Vault.
Tinggi (P0)
Wakif Dashboard
UI untuk melihat riwayat deposit, estimasi yield, countdown masa tenor (lock period), dan status masa tunggu (unbonding) saat penarikan.
Tinggi (P0)
Nadzir Portal
Antarmuka bagi Nadzir untuk mengelola pencairan dana dan otomatisasi pencatatan.
Menengah (P1)

Kriteria Sukses (Success Metrics)
Principal Safety Rate: Nilai wqIDRX selalu aman terlepas dari fluktuasi pasar.
Distribution Efficiency: Gas fee < 5% dari total yield yang disalurkan.
System Uptime: Dasbor dan smart contract dapat diakses 24/7.

