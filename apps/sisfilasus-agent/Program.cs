using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace SisFilaSusAgent
{
    public class Config
    {
        public const string Version = "1.3.1";
        public string EsusHost = "10.110.2.8";
        public int EsusPort = 5433;
        public string EsusDb = "esus";
        public string EsusUser = "esus_leitura";
        public string EsusPassword = "";
        public string SisFilaSusUrl = "https://sisfilasus.vps.atb.app.br";
        public string SupabaseUrl = "https://supabase-sisfilasus.coolify.vps.atb.app.br";
        public string SupabaseServiceKey = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4MDY5NjMyMCwiZXhwIjo0OTM2MzY5OTIwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.mx_pcM74ValOQKHGAyoAhskcFTg3Qp6MxKIlMSXI61k";
        public string AgentId = "SMS-AGENT-" + Environment.MachineName;
    }

    public static class SecurityHelper
    {
        private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("SisFilaSus-Secret-2026");

        public static string Encrypt(string plainText)
        {
            if (string.IsNullOrEmpty(plainText)) return "";
            try
            {
                byte[] bytes = Encoding.UTF8.GetBytes(plainText);
                byte[] enc = ProtectedData.Protect(bytes, Entropy, DataProtectionScope.CurrentUser);
                return Convert.ToBase64String(enc);
            }
            catch { return ""; }
        }

        public static string Decrypt(string cipherText)
        {
            if (string.IsNullOrEmpty(cipherText)) return "";
            try
            {
                byte[] bytes = Convert.FromBase64String(cipherText);
                byte[] dec = ProtectedData.Unprotect(bytes, Entropy, DataProtectionScope.CurrentUser);
                return Encoding.UTF8.GetString(dec);
            }
            catch { return ""; }
        }
    }

    public class ConfigManager
    {
        private static readonly string ConfigPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "agent-config.cfg");

        public static Config Load()
        {
            var cfg = new Config();
            if (!File.Exists(ConfigPath)) return cfg;

            try
            {
                string[] lines = File.ReadAllLines(ConfigPath);
                foreach (string line in lines)
                {
                    int eq = line.IndexOf('=');
                    if (eq <= 0) continue;
                    string key = line.Substring(0, eq).Trim();
                    string val = line.Substring(eq + 1).Trim();

                    if (key == "ESUS_HOST") cfg.EsusHost = val;
                    else if (key == "ESUS_PORT") int.TryParse(val, out cfg.EsusPort);
                    else if (key == "ESUS_DB") cfg.EsusDb = val;
                    else if (key == "ESUS_USER") cfg.EsusUser = val;
                    else if (key == "ESUS_PASS_ENC") cfg.EsusPassword = SecurityHelper.Decrypt(val);
                    else if (key == "SISFILASUS_URL")
                    {
                        if (string.IsNullOrEmpty(val) || val.Contains("fila.maraba.pa.gov.br"))
                            cfg.SisFilaSusUrl = "https://sisfilasus.vps.atb.app.br";
                        else
                            cfg.SisFilaSusUrl = val;
                    }
                    else if (key == "SUPABASE_URL") cfg.SupabaseUrl = val;
                    else if (key == "SUPABASE_KEY") cfg.SupabaseServiceKey = val;
                    else if (key == "AGENT_ID") cfg.AgentId = val;
                }
            }
            catch { }
            return cfg;
        }

        public static void Save(Config cfg)
        {
            try
            {
                var sb = new StringBuilder();
                sb.AppendLine("ESUS_HOST=" + cfg.EsusHost);
                sb.AppendLine("ESUS_PORT=" + cfg.EsusPort);
                sb.AppendLine("ESUS_DB=" + cfg.EsusDb);
                sb.AppendLine("ESUS_USER=" + cfg.EsusUser);
                sb.AppendLine("ESUS_PASS_ENC=" + SecurityHelper.Encrypt(cfg.EsusPassword));
                sb.AppendLine("SISFILASUS_URL=" + cfg.SisFilaSusUrl);
                sb.AppendLine("SUPABASE_URL=" + cfg.SupabaseUrl);
                sb.AppendLine("SUPABASE_KEY=" + cfg.SupabaseServiceKey);
                sb.AppendLine("AGENT_ID=" + cfg.AgentId);
                File.WriteAllText(ConfigPath, sb.ToString(), Encoding.UTF8);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Erro ao salvar configurações: " + ex.Message, "SisFilaSUS", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }

    public class ConfigForm : Form
    {
        private TextBox txtHost, txtPort, txtDb, txtUser, txtPass, txtAppUrl, txtKey;
        private Button btnTest, btnSave, btnCancel;

        public ConfigForm(Config cfg)
        {
            this.Text = "SisFilaSUS - Configuração do Conector e-SUS PEC (v" + Config.Version + ")";
            this.Width = 500;
            this.Height = 460;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;

            int top = 15;

            // Grupo e-SUS
            var grpEsus = new GroupBox() { Text = "Banco de Dados e-SUS PEC (Local)", Top = top, Left = 15, Width = 455, Height = 185 };
            
            grpEsus.Controls.Add(new Label() { Text = "Host:", Top = 25, Left = 15, Width = 70 });
            txtHost = new TextBox() { Text = cfg.EsusHost, Top = 22, Left = 90, Width = 160 };
            grpEsus.Controls.Add(txtHost);

            grpEsus.Controls.Add(new Label() { Text = "Porta:", Top = 25, Left = 265, Width = 45 });
            txtPort = new TextBox() { Text = cfg.EsusPort.ToString(), Top = 22, Left = 315, Width = 120 };
            grpEsus.Controls.Add(txtPort);

            grpEsus.Controls.Add(new Label() { Text = "Banco:", Top = 55, Left = 15, Width = 70 });
            txtDb = new TextBox() { Text = cfg.EsusDb, Top = 52, Left = 90, Width = 160 };
            grpEsus.Controls.Add(txtDb);

            grpEsus.Controls.Add(new Label() { Text = "Usuário:", Top = 85, Left = 15, Width = 70 });
            txtUser = new TextBox() { Text = cfg.EsusUser, Top = 82, Left = 90, Width = 160 };
            grpEsus.Controls.Add(txtUser);

            grpEsus.Controls.Add(new Label() { Text = "Senha:", Top = 115, Left = 15, Width = 70 });
            txtPass = new TextBox() { Text = cfg.EsusPassword, Top = 112, Left = 90, Width = 345, PasswordChar = '•' };
            grpEsus.Controls.Add(txtPass);

            btnTest = new Button() { Text = "🔌 Testar Conexão Local", Top = 145, Left = 90, Width = 180, Height = 28 };
            btnTest.Click += (s, e) => TestConnection();
            grpEsus.Controls.Add(btnTest);

            this.Controls.Add(grpEsus);
            top += 195;

            // Grupo Nuvem
            var grpCloud = new GroupBox() { Text = "Conexão Nuvem SisFilaSUS", Top = top, Left = 15, Width = 455, Height = 135 };
            
            grpCloud.Controls.Add(new Label() { Text = "URL Sistema:", Top = 25, Left = 15, Width = 80 });
            txtAppUrl = new TextBox() { Text = cfg.SisFilaSusUrl, Top = 22, Left = 100, Width = 335 };
            grpCloud.Controls.Add(txtAppUrl);

            grpCloud.Controls.Add(new Label() { Text = "Identificador:", Top = 55, Left = 15, Width = 80 });
            var txtId = new TextBox() { Text = cfg.AgentId, Top = 52, Left = 100, Width = 335, ReadOnly = true };
            grpCloud.Controls.Add(txtId);

            grpCloud.Controls.Add(new Label() { Text = "Chave Serviço:", Top = 85, Left = 15, Width = 85 });
            txtKey = new TextBox() { Text = cfg.SupabaseServiceKey, Top = 82, Left = 100, Width = 335, PasswordChar = '•' };
            grpCloud.Controls.Add(txtKey);

            this.Controls.Add(grpCloud);
            top += 145;

            // Botões
            btnSave = new Button() { Text = "💾 Salvar Configurações", Top = top, Left = 190, Width = 180, Height = 32 };
            btnSave.Click += (s, e) => {
                cfg.EsusHost = txtHost.Text.Trim();
                int port;
                if (int.TryParse(txtPort.Text.Trim(), out port)) cfg.EsusPort = port;
                cfg.EsusDb = txtDb.Text.Trim();
                cfg.EsusUser = txtUser.Text.Trim();
                cfg.EsusPassword = txtPass.Text;
                cfg.SisFilaSusUrl = txtAppUrl.Text.Trim();
                cfg.SupabaseServiceKey = txtKey.Text.Trim();
                ConfigManager.Save(cfg);
                MessageBox.Show("Configurações salvas e protegidas com sucesso com DPAPI!", "SisFilaSUS", MessageBoxButtons.OK, MessageBoxIcon.Information);
                this.Close();
            };
            this.Controls.Add(btnSave);

            btnCancel = new Button() { Text = "Fechar", Top = top, Left = 380, Width = 90, Height = 32 };
            btnCancel.Click += (s, e) => this.Close();
            this.Controls.Add(btnCancel);
        }

        private void TestConnection()
        {
            try
            {
                using (var client = new System.Net.Sockets.TcpClient())
                {
                    int port;
                    int.TryParse(txtPort.Text.Trim(), out port);
                    client.Connect(txtHost.Text.Trim(), port);
                    MessageBox.Show("Porta " + port + " conectada com sucesso no host local (" + txtHost.Text.Trim() + ")!", "Teste de Conexão", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Falha na conexão local: " + ex.Message, "Teste de Conexão", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }

    public class TrayAppContext : ApplicationContext
    {
        private NotifyIcon trayIcon;
        private ContextMenuStrip menu;
        private ToolStripMenuItem mnuStatus;
        private ToolStripMenuItem mnuVersion;
        private Config config;
        private System.Windows.Forms.Timer pollTimer;
        private System.Windows.Forms.Timer updateTimer;
        private Process workerProcess = null;
        private bool isCheckingUpdate = false;

        public TrayAppContext()
        {
            // Forçar protocolos seguros TLS 1.2 no .NET Framework
            ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072 | (SecurityProtocolType)768 | SecurityProtocolType.Tls;

            // Limpar arquivo .antigo de auto-atualização anterior se houver
            LimparVersaoAntiga();

            config = ConfigManager.Load();

            menu = new ContextMenuStrip();
            var title = new ToolStripMenuItem("SisFilaSUS - Agente e-SUS PEC (v" + Config.Version + ")") { Enabled = false };
            title.Font = new Font(title.Font, FontStyle.Bold);
            menu.Items.Add(title);
            menu.Items.Add(new ToolStripSeparator());

            mnuStatus = new ToolStripMenuItem("Status: Conectando à nuvem...") { Enabled = false };
            menu.Items.Add(mnuStatus);

            var mnuConfig = new ToolStripMenuItem("⚙️ Configurar Credenciais e-SUS...", null, (s, e) => {
                new ConfigForm(config).ShowDialog();
            });
            menu.Items.Add(mnuConfig);

            var mnuCheckNow = new ToolStripMenuItem("⚡ Checar Fila do SisFilaSUS Agora", null, (s, e) => {
                SendHeartbeatOnce();
            });
            menu.Items.Add(mnuCheckNow);

            mnuVersion = new ToolStripMenuItem("🔄 Verificar Atualização...", null, (s, e) => {
                CheckAndApplyUpdate(manual: true);
            });
            menu.Items.Add(mnuVersion);

            var mnuAutoStart = new ToolStripMenuItem("🚀 Iniciar junto com o Windows", null, ToggleAutoStart);
            mnuAutoStart.Checked = IsAutoStartEnabled();
            menu.Items.Add(mnuAutoStart);

            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(new ToolStripMenuItem("❌ Encerrar Agente", null, (s, e) => {
                EncerrarTudo();
            }));

            trayIcon = new NotifyIcon()
            {
                Icon = SystemIcons.Shield,
                ContextMenuStrip = menu,
                Text = "SisFilaSUS - Agente e-SUS PEC (v" + Config.Version + ")",
                Visible = true
            };

            trayIcon.ShowBalloonTip(3000, "SisFilaSUS Agente v" + Config.Version, "Agente ativo e comunicando com o SisFilaSUS.", ToolTipIcon.Info);

            // Timer de Heartbeat (a cada 15 segundos)
            pollTimer = new System.Windows.Forms.Timer();
            pollTimer.Interval = 15000;
            pollTimer.Tick += (s, e) => SendHeartbeatOnce();
            pollTimer.Start();

            // Timer de Auto-Atualização (a cada 1 hora)
            updateTimer = new System.Windows.Forms.Timer();
            updateTimer.Interval = 60 * 60 * 1000;
            updateTimer.Tick += (s, e) => CheckAndApplyUpdate(manual: false);
            updateTimer.Start();

            // Disparo imediato do primeiro heartbeat e verificação de atualização
            ThreadPool.QueueUserWorkItem(s =>
            {
                Thread.Sleep(1500);
                SendHeartbeatOnce();
                Thread.Sleep(3000);
                CheckAndApplyUpdate(manual: false);
                IniciarMotorSincronizacao();
            });
        }

        private void LimparVersaoAntiga()
        {
            try
            {
                string exeAntigo = Application.ExecutablePath + ".antigo";
                if (File.Exists(exeAntigo))
                {
                    File.Delete(exeAntigo);
                }
            }
            catch { }
        }

        private void UpdateStatus(bool online, string msg)
        {
            if (trayIcon.ContextMenuStrip.InvokeRequired)
            {
                trayIcon.ContextMenuStrip.BeginInvoke(new Action(() => UpdateStatus(online, msg)));
                return;
            }

            if (online)
            {
                mnuStatus.Text = "● Status: Conectado e Aguardando (v" + Config.Version + ")";
                trayIcon.Text = "SisFilaSUS Agente: Conectado (v" + Config.Version + ")";
            }
            else
            {
                mnuStatus.Text = "○ Status: " + msg;
                trayIcon.Text = "SisFilaSUS Agente: Desconectado";
            }
        }

        private void SendHeartbeatOnce()
        {
            ThreadPool.QueueUserWorkItem(state =>
            {
                bool success = false;
                string errMsg = "Erro de conexão";

                // 1. Tentar Heartbeat via Supabase REST diretamente
                try
                {
                    if (!string.IsNullOrEmpty(config.SupabaseUrl) && !string.IsNullOrEmpty(config.SupabaseServiceKey))
                    {
                        string supaUrl = config.SupabaseUrl.TrimEnd('/') + "/rest/v1/esus_agentes";
                        string nowIso = DateTime.UtcNow.ToString("o");
                        string json = string.Format(
                            "{{\"identificador\":\"{0}\",\"versao\":\"{1}\",\"status\":\"ONLINE\",\"ultimo_heartbeat\":\"{2}\",\"metadados\":{{\"hostname\":\"{3}\",\"platform\":\"win32\",\"esus_host\":\"{4}\"}},\"updated_at\":\"{2}\"}}",
                            config.AgentId, Config.Version, nowIso, Environment.MachineName, config.EsusHost
                        );

                        using (var wc = new WebClient())
                        {
                            wc.Headers[HttpRequestHeader.ContentType] = "application/json";
                            wc.Headers["apikey"] = config.SupabaseServiceKey;
                            wc.Headers["Authorization"] = "Bearer " + config.SupabaseServiceKey;
                            wc.Headers["Prefer"] = "resolution=merge-duplicates";
                            wc.UploadString(supaUrl, "POST", json);
                            success = true;
                        }
                    }
                }
                catch (Exception ex)
                {
                    errMsg = ex.Message;
                }

                // 2. Tentar Heartbeat via SisFilaSUS App API
                if (!success && !string.IsNullOrEmpty(config.SisFilaSusUrl))
                {
                    try
                    {
                        string appUrl = config.SisFilaSusUrl;
                        if (string.IsNullOrEmpty(appUrl) || appUrl.Contains("fila.maraba.pa.gov.br"))
                            appUrl = "https://sisfilasus.vps.atb.app.br";

                        string appHeartbeatUrl = appUrl.TrimEnd('/') + "/api/esus-agent/heartbeat";
                        string json = string.Format(
                            "{{\"identificador\":\"{0}\",\"versao\":\"{1}\",\"status\":\"ONLINE\",\"metadados\":{{\"hostname\":\"{2}\",\"esus_host\":\"{3}\"}}}}",
                            config.AgentId, Config.Version, Environment.MachineName, config.EsusHost
                        );

                        using (var wc = new WebClient())
                        {
                            wc.Headers[HttpRequestHeader.ContentType] = "application/json";
                            string res = wc.UploadString(appHeartbeatUrl, "POST", json);
                            if (res.Contains("\"success\":true") || res.Contains("\"online\":true"))
                            {
                                success = true;
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        errMsg = ex.Message;
                    }
                }

                UpdateStatus(success, success ? "Conectado" : "Sem conexão com a nuvem");
            });
        }

        // =====================================================================
        // AUTO-ATUALIZAÇÃO AUTOMÁTICA (ESTILO SIS-ESCALA)
        // =====================================================================
        private void CheckAndApplyUpdate(bool manual)
        {
            if (isCheckingUpdate) return;
            isCheckingUpdate = true;

            ThreadPool.QueueUserWorkItem(state =>
            {
                try
                {
                    string baseUrl = config.SisFilaSusUrl;
                    if (string.IsNullOrEmpty(baseUrl) || baseUrl.Contains("fila.maraba.pa.gov.br"))
                        baseUrl = "https://sisfilasus.vps.atb.app.br";

                    string versionUrl = baseUrl.TrimEnd('/') + "/api/esus-agent/tray-version";
                    string json;

                    using (var wc = new WebClient())
                    {
                        wc.Headers[HttpRequestHeader.UserAgent] = "SisFilaSusAgent/" + Config.Version;
                        json = wc.DownloadString(versionUrl);
                    }

                    // Extrair campos da resposta JSON com Regex simples
                    string versaoServidor = ExtractJsonField(json, "versao");
                    string sha256Servidor = ExtractJsonField(json, "sha256");
                    string autoUpdateStr = ExtractJsonField(json, "auto_update");
                    bool autoUpdate = autoUpdateStr != "false";

                    if (string.IsNullOrEmpty(versaoServidor))
                    {
                        if (manual) MessageBox.Show("Servidor não retornou uma versão válida para atualização.", "SisFilaSUS", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                        return;
                    }

                    bool temNova = CompararVersoes(versaoServidor, Config.Version) > 0;

                    if (!temNova)
                    {
                        if (manual)
                        {
                            MessageBox.Show("O SisFilaSUS Agente já está na versão mais recente (v" + Config.Version + ").", "Atualização", MessageBoxButtons.OK, MessageBoxIcon.Information);
                        }
                        return;
                    }

                    // Nova versão detectada!
                    trayIcon.ShowBalloonTip(4000, "Atualização Disponível", "Nova versão v" + versaoServidor + " encontrada. Atualizando automaticamente...", ToolTipIcon.Info);

                    // Baixar novo executável para pasta temporária
                    string downloadUrl = baseUrl.TrimEnd('/') + "/api/esus-agent/tray-download";
                    string tempFile = Path.Combine(Path.GetTempPath(), "SisFilaSusAgent_v" + versaoServidor + "_" + Guid.NewGuid().ToString().Substring(0, 8) + ".exe");

                    using (var wc = new WebClient())
                    {
                        wc.DownloadFile(downloadUrl, tempFile);
                    }

                    // Validar SHA-256 se informado pelo servidor
                    if (!string.IsNullOrEmpty(sha256Servidor))
                    {
                        string shaCalculado = CalcularSha256(tempFile);
                        if (!string.Equals(shaCalculado, sha256Servidor, StringComparison.OrdinalIgnoreCase))
                        {
                            File.Delete(tempFile);
                            if (manual) MessageBox.Show("O arquivo de atualização baixado falhou na verificação de integridade (SHA256).", "Erro de Atualização", MessageBoxButtons.OK, MessageBoxIcon.Error);
                            return;
                        }
                    }

                    // Aplicar substituição do executável (padrão Windows: renomear em execução -> copiar novo -> relançar)
                    string exeAtual = Application.ExecutablePath;
                    string exeAntigo = exeAtual + ".antigo";

                    if (File.Exists(exeAntigo))
                    {
                        try { File.Delete(exeAntigo); } catch { }
                    }

                    File.Move(exeAtual, exeAntigo);
                    File.Copy(tempFile, exeAtual, true);
                    try { File.Delete(tempFile); } catch { }

                    // Relançar novo executável e sair
                    Process.Start(exeAtual);

                    trayIcon.Visible = false;
                    Application.Exit();
                }
                catch (Exception ex)
                {
                    if (manual)
                    {
                        MessageBox.Show("Falha ao verificar/aplicar atualização: " + ex.Message, "SisFilaSUS", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    }
                }
                finally
                {
                    isCheckingUpdate = false;
                }
            });
        }

        private static string ExtractJsonField(string json, string field)
        {
            var match = Regex.Match(json, "\"" + field + "\"\\s*:\\s*\"?([^\",\\}]+)\"?");
            return match.Success ? match.Groups[1].Value.Trim() : "";
        }

        private static int CompararVersoes(string a, string b)
        {
            try
            {
                Version vA = new Version(a);
                Version vB = new Version(b);
                return vA.CompareTo(vB);
            }
            catch
            {
                return string.Compare(a, b, StringComparison.OrdinalIgnoreCase);
            }
        }

        private static string CalcularSha256(string filePath)
        {
            using (var sha = SHA256.Create())
            using (var stream = File.OpenRead(filePath))
            {
                byte[] hash = sha.ComputeHash(stream);
                var sb = new StringBuilder();
                foreach (byte b in hash) sb.Append(b.ToString("x2"));
                return sb.ToString();
            }
        }

        // =====================================================================
        // MOTOR DE SINCRONIZAÇÃO (SUPERVISÃO CONTÍNUA 24X7)
        // =====================================================================
        private void IniciarMotorSincronizacao()
        {
            try
            {
                // Verifica se há script node ou runner bat no mesmo diretório
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string runnerBat = Path.Combine(baseDir, "runner.bat");
                string agentScript = Path.Combine(baseDir, "sync-esus-agent.mjs");

                if (!File.Exists(agentScript))
                {
                    // Tentar localizar em pasta do projeto
                    string projScript = Path.Combine(baseDir, @"..\..\scripts\sync-esus-agent.mjs");
                    if (File.Exists(projScript)) agentScript = Path.GetFullPath(projScript);
                }

                if (File.Exists(runnerBat))
                {
                    var psi = new ProcessStartInfo(runnerBat)
                    {
                        CreateNoWindow = true,
                        UseShellExecute = false,
                        WorkingDirectory = baseDir
                    };
                    workerProcess = Process.Start(psi);
                }
            }
            catch { }
        }

        private void EncerrarTudo()
        {
            try
            {
                if (workerProcess != null && !workerProcess.HasExited)
                {
                    workerProcess.Kill();
                }
            }
            catch { }

            trayIcon.Visible = false;
            Application.Exit();
        }

        private bool IsAutoStartEnabled()
        {
            try
            {
                using (var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", false))
                {
                    if (key != null)
                    {
                        return key.GetValue("SisFilaSusAgent") != null;
                    }
                    return false;
                }
            }
            catch { return false; }
        }

        private void ToggleAutoStart(object sender, EventArgs e)
        {
            var item = sender as ToolStripMenuItem;
            if (item == null) return;

            try
            {
                using (var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true))
                {
                    if (item.Checked)
                    {
                        key.DeleteValue("SisFilaSusAgent", false);
                        item.Checked = false;
                    }
                    else
                    {
                        key.SetValue("SisFilaSusAgent", "\"" + Application.ExecutablePath + "\"");
                        item.Checked = true;
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Erro ao alterar inicialização automática: " + ex.Message);
            }
        }
    }

    static class Program
    {
        [STAThread]
        static void Main()
        {
            // Garantir instância única do agente na bandeja
            bool createdNew;
            using (var mutex = new Mutex(true, "SisFilaSusAgent_SingleInstance_Mutex", out createdNew))
            {
                if (!createdNew)
                {
                    MessageBox.Show("O SisFilaSUS Agente já está em execução na bandeja do sistema.", "SisFilaSUS", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new TrayAppContext());
            }
        }
    }
}
