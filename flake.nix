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
          ];

          shellHook = ''
            export SSL_CERT_FILE="''${NIX_SSL_CERT_FILE:-/etc/ssl/certs/ca-certificates.crt}"

            export ANDROID_HOME="$HOME/Android/Sdk"
            export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/36.0.0:$PATH"

            export GRADLE_OPTS="-Dorg.gradle.daemon=true -Dorg.gradle.parallel=true"

            export WRANGLER_SEND_METRICS="false"

            export VERTEXAI_LOCATION="global"
            export VERTEXAI_PROJECT="project-61fdbcb8-2ddf-4f57-901"
          '';
        };
      }
    );
}
