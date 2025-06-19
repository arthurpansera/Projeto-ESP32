@ -1,20 +0,0 @@
#define SENSOR_PIN 14 // Pino conectado ao sensor de fluxo

volatile int pulseCount = 0; // Contador de pulsos

void IRAM_ATTR pulseInterrupt() {
  pulseCount++; // A cada pulso, incrementa o contador
}

void setup() {
  Serial.begin(115200);
  pinMode(SENSOR_PIN, INPUT_PULLUP);  // Configura o pino do sensor como entrada
  attachInterrupt(digitalPinToInterrupt(SENSOR_PIN), pulseInterrupt, FALLING); // Interrupção para contar os pulsos
}

void loop() {
  // Imprime o número de pulsos a cada 1 segundo
  Serial.print("Pulsos: ");
  Serial.println(pulseCount);
  delay(1000);  // Aguarda 1 segundo
}