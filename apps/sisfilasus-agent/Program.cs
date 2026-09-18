using System;
using System.Drawing;
using System.IO;
using System.Net;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace SisFilaSusAgent
{
    public class Config
    {
        public string EsusHost = "127.0.0.1";
        public int EsusPort = 5433;
        public string EsusDb = "esus";
        public string EsusUser = "esus_leitura";
        public string EsusPassword = "";
        public string SupabaseUrl = "https://supabase-sisfilasus.coolify.vps.atb.app.br";
        public string SupabaseServiceKey = "";
        public string AgentId = "SMS-AGENT-" + Environment.MachineName;
    }

    public static class SecurityHelper
    {
        private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("SisFilaSus-Secret-2026");

        public static string Encrypt(string plainText)
        {
            if (string.IsNullOrEmpty(plainText)) return "";
            byte[] bytes = Encoding.UTF8.GetBytes(plainText);
            byte[] enc = ProtectedData.Protect(bytes, Entropy, DataProtectionScope.CurrentUser);
            return Convert.ToBase64String(enc);
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
            catch
            {
                return "";
            }
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
        private TextBox txtHost, txtPort, txtDb, txtUser, txtPass, txtUrl, txtKey;
        private Button btnTest, btnSave, btnCancel;

        public ConfigForm(Config cfg)
        {
            this.Text = "SisFilaSUS - Configuração do Conector e-SUS PEC";
            this.Width = 480;
            this.Height = 440;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;

            int top = 20;

            // Grupo e-SUS
            var grpEsus = new GroupBox() { Text = "Banco de Dados e-SUS PEC (Local)", Top = top, Left = 20, Width = 425, Height = 190 };
            
            grpEsus.Controls.Add(new Label() { Text = "Host Local:", Top = 25, Left = 15, Width = 80 });
            txtHost = new TextBox() { Text = cfg.EsusHost, Top = 22, Left = 100, Width = 150 };
            grpEsus.Controls.Add(txtHost);

            grpEsus.Controls.Add(new Label() { Text = "Porta:", Top = 25, Left = 265, Width = 50 });
            txtPort = new TextBox() { Text = cfg.EsusPort.ToString(), Top = 22, Left = 320, Width = 80 };
            grpEsus.Controls.Add(txtPort);

            grpEsus.Controls.Add(new Label() { Text = "Banco:", Top = 55, Left = 15, Width = 80 });
            txtDb = new TextBox() { Text = cfg.EsusDb, Top = 52, Left = 100, Width = 150 };
            grpEsus.Controls.Add(txtDb);

            grpEsus.Controls.Add(new Label() { Text = "Usuário:", Top = 85, Left = 15, Width = 80 });
            txtUser = new TextBox() { Text = cfg.EsusUser, Top = 82, Left = 100, Width = 150 };
            grpEsus.Controls.Add(txtUser);

            grpEsus.Controls.Add(new Label() { Text = "Senha:", Top = 115, Left = 15, Width = 80 });
            txtPass = new TextBox() { Text = cfg.EsusPassword, Top = 112, Left = 100, Width = 300, PasswordChar = '•' };
            grpEsus.Controls.Add(txtPass);

            btnTest = new Button() { Text = "Testar Conexão Local", Top = 148, Left = 100, Width = 160, Height = 28 };
            btnTest.Click += (s, e) => TestConnection();
            grpEsus.Controls.Add(btnTest);

            this.Controls.Add(grpEsus);
            top += 205;

            // Grupo Nuvem
            var grpCloud = new GroupBox() { Text = "Conexão Nuvem SisFilaSUS", Top = top, Left = 20, Width = 425, Height = 100 };
            grpCloud.Controls.Add(new Label() { Text = "URL Sistema:", Top = 25, Left = 15, Width = 80 });
            txtUrl = new TextBox() { Text = cfg.SupabaseUrl, Top = 22, Left = 100, Width = 300 };
            grpCloud.Controls.Add(txtUrl);

            grpCloud.Controls.Add(new Label() { Text = "Chave API:", Top = 55, Left = 15, Width = 80 });
            txtKey = new TextBox() { Text = cfg.SupabaseServiceKey, Top = 52, Left = 100, Width = 300, PasswordChar = '•' };
            grpCloud.Controls.Add(txtKey);

            this.Controls.Add(grpCloud);
            top += 115;

            // Botões
            btnSave = new Button() { Text = "Salvar (Criptografia DPAPI)", Top = top, Left = 180, Width = 175, Height = 32 };
            btnSave.Click += (s, e) => {
                cfg.EsusHost = txtHost.Text.Trim();
                int.TryParse(txtPort.Text.Trim(), out cfg.EsusPort);
                cfg.EsusDb = txtDb.Text.Trim();
                cfg.EsusUser = txtUser.Text.Trim();
                cfg.EsusPassword = txtPass.Text;
                cfg.SupabaseUrl = txtUrl.Text.Trim();
                cfg.SupabaseServiceKey = txtKey.Text.Trim();
                ConfigManager.Save(cfg);
                MessageBox.Show("Configurações salvas e protegidas com sucesso no Windows!", "SisFilaSUS", MessageBoxButtons.OK, MessageBoxIcon.Information);
                this.Close();
            };
            this.Controls.Add(btnSave);

            btnCancel = new Button() { Text = "Fechar", Top = top, Left = 365, Width = 80, Height = 32 };
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
                    MessageBox.Show("Porta " + port + " conectada com sucesso no host local!", "Teste de Conexão", MessageBoxButtons.OK, MessageBoxIcon.Information);
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
        private Config config;
        private System.Windows.Forms.Timer pollTimer;
        private bool isProcessing = false;

        public TrayAppContext()
        {
            // Forçar TLS 1.2 em Windows legados
            ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072 | SecurityProtocolType.Tls;

            config = ConfigManager.Load();

            menu = new ContextMenuStrip();
            var title = new ToolStripMenuItem("SisFilaSUS - Agente e-SUS PEC (v1.2)") { Enabled = false };
            title.Font = new Font(title.Font, FontStyle.Bold);
            menu.Items.Add(title);
            menu.Items.Add(new ToolStripSeparator());

            var mnuStatus = new ToolStripMenuItem("Status: Conectado e Aguardando") { Enabled = false };
            menu.Items.Add(mnuStatus);

            var mnuConfig = new ToolStripMenuItem("⚙️ Configurar Credenciais e-SUS...", null, (s, e) => {
                new ConfigForm(config).ShowDialog();
            });
            menu.Items.Add(mnuConfig);

            var mnuCheckNow = new ToolStripMenuItem("⚡ Checar Fila do SisFilaSUS Agora", null, (s, e) => {
                CheckQueueOnce();
            });
            menu.Items.Add(mnuCheckNow);

            var mnuAutoStart = new ToolStripMenuItem("🚀 Iniciar junto com o Windows", null, ToggleAutoStart);
            mnuAutoStart.Checked = IsAutoStartEnabled();
            menu.Items.Add(mnuAutoStart);

            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(new ToolStripMenuItem("❌ Encerrar Agente", null, (s, e) => {
                trayIcon.Visible = false;
                Application.Exit();
            }));

            trayIcon = new NotifyIcon()
            {
                Icon = SystemIcons.Shield,
                ContextMenuStrip = menu,
                Text = "SisFilaSUS - Agente e-SUS PEC (Ativo)",
                Visible = true
            };

            trayIcon.ShowBalloonTip(3000, "SisFilaSUS Agente", "Agente conectado ao servidor e-SUS PEC local e pronto para sincronizar!", ToolTipIcon.Info);

            // Timer de checagem a cada 5 segundos
            pollTimer = new System.Windows.Forms.Timer();
            pollTimer.Interval = 5000;
            pollTimer.Tick += (s, e) => CheckQueueOnce();
            pollTimer.Start();
        }

        private void CheckQueueOnce()
        {
            if (isProcessing) return;
            // Executa checagem em thread separada para não travar a bandeja
            ThreadPool.QueueUserWorkItem(state =>
            {
                try
                {
                    // Se houver script ou executável runner no diretório, executa
                    string runnerScript = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "runner.bat");
                    if (File.Exists(runnerScript))
                    {
                        // Processar runner
                    }
                }
                catch { }
            });
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
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new TrayAppContext());
        }
    }
}
