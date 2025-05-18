#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>
#include "time.h"

// ----------- CONFIGURAÇÕES DE CONEXÃO WI-FI E FIREBASE -----------

//deixando sem por motivos de privacidade e segurança

// ----------- CONFIGURAÇÕES DO NTP -----------
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = -10800; //
const int daylightOffset_sec = 0;

// ----------- VARIÁVEIS SENSOR -----------
volatile int pulsos = 0;
float vazao_Lmin = 0.0;
unsigned long tempoUltimaLeitura = 0;
const unsigned long intervaloLeitura = 1000;

#define PINO_SENSOR 18
const float fator_calibracao = 7.5;

// ----------- OBJETOS DO FIREBASE -----------
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

bool signupOK = false;

void IRAM_ATTR contaPulso() {
  pulsos++;
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("Inicializando sensor...");
  pinMode(PINO_SENSOR, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PINO_SENSOR), contaPulso, FALLING);

  // Parte do wifi
  Serial.println("Conectando ao Wi-Fi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long startWiFi = millis();
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
    if (millis() - startWiFi > 15000) {
      Serial.println("\nFalha ao conectar Wi-Fi. Reiniciando...");
      ESP.restart();
    }
  }
  Serial.println("\n✅ Wi-Fi conectado!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  // Parte do NPT (horário)
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.print("Sincronizando horário");
  struct tm timeinfo;
  while (!getLocalTime(&timeinfo)) {
    Serial.print(".");
    delay(500);
  }
  Serial.println("\nHorário sincronizado:");
  Serial.println(&timeinfo, "%Y-%m-%d %H:%M:%S");

  // Parte do FireBase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  auth.user.email = "";
  auth.user.password = "";
  config.token_status_callback = tokenStatusCallback;

  Serial.println("Realizando signUp anônimo...");
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("SignUp realizado com sucesso!");
    signupOK = true;
  } else {
    Serial.printf("Erro no signUp: %s\n", config.signer.signupError.message.c_str());
  }

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void loop() {
  if (signupOK && Firebase.ready()) {
    if (millis() - tempoUltimaLeitura >= intervaloLeitura) {
      tempoUltimaLeitura = millis();

      int pulsosPorSegundo = pulsos;
      pulsos = 0;

      vazao_Lmin = (float)pulsosPorSegundo / fator_calibracao;

      Serial.print("Pulsos por segundo: ");
      Serial.print(pulsosPorSegundo);
      Serial.print(" | Vazão: ");
      Serial.print(vazao_Lmin);
      Serial.println(" L/min");

      if (Firebase.RTDB.setFloat(&fbdo, "/leituras/vazao_Lmin", vazao_Lmin)) {
          Serial.println("✅ Valor atual enviado com sucesso!");
      } else {
          Serial.print("❌ Erro ao enviar valor atual: ");
          Serial.println(fbdo.errorReason());
      }

      // Salvar no histórico com timestamp como chave
      time_t now;
      struct tm timeinfo;
      time(&now);
      localtime_r(&now, &timeinfo);

      char timestamp[20];
      strftime(timestamp, sizeof(timestamp), "%Y-%m-%d_%H-%M-%S", &timeinfo); // Formato sem caracteres inválidos

      String path = "/leituras_com_tempo/" + String(timestamp);
      if (Firebase.RTDB.setFloat(&fbdo, path.c_str(), vazao_Lmin)) {
          Serial.println("✅ Histórico enviado com sucesso!");
      } else {
          Serial.print("❌ Erro ao enviar histórico: ");
          Serial.println(fbdo.errorReason());
      }

    }
  } else {
    if (!signupOK) Serial.println("⚠️ SignUp não realizado.");
    if (!Firebase.ready()) Serial.println("⚠️ Firebase não está pronto.");
    delay(2000);
  }
}



