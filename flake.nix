{
  description = "ulasim20";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        packages.pocketbase = pkgs.pocketbase;
        packages.default = pkgs.pocketbase;

        apps.pocketbase = flake-utils.lib.mkApp {
          drv = pkgs.pocketbase;
          name = "pocketbase";
        };
        apps.default = flake-utils.lib.mkApp {
          drv = pkgs.pocketbase;
          name = "pocketbase";
        };

        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_22
            corepack
            cacert
            jdk21
            gradle
            android-tools
            google-cloud-sdk
            pocketbase
            playwright-driver.browsers
          ];

          shellHook = ''
            export SSL_CERT_FILE="''${NIX_SSL_CERT_FILE:-/etc/ssl/certs/ca-certificates.crt}"

            export ANDROID_HOME="$HOME/Android/Sdk"
            export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/36.0.0:$PATH"

            export GRADLE_OPTS="-Dorg.gradle.daemon=true -Dorg.gradle.parallel=true"

            export WRANGLER_SEND_METRICS="false"

            export VERTEXAI_LOCATION="global"
            export VERTEXAI_PROJECT="project-61fdbcb8-2ddf-4f57-901"

            # Playwright'a tarayıcıları indirdiği yerde değil, Nix deposundan almasını söyle
            export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}

            # Playwright'ın "Bilinmeyen Linux Dağıtımı" veya eksik bağımlılık hatası vermesini engelle
            export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true

            # (Opsiyonel) Platform uyumsuzluklarını aşmak için NixOS Wiki'nin önerdiği geçici çözüm
            export PLAYWRIGHT_HOST_PLATFORM_OVERRIDE="ubuntu-24.04"
          '';
        };
      }
    );
}
