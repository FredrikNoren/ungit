{
  description = "A basic flake with a shell";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  inputs.flake-utils.url = "github:numtide/flake-utils";

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShell = pkgs.mkShell {

          nativeBuildInputs = with pkgs; [
            bashInteractive
            python3
            nodejs-16_x
            libkrb5
            e2fsprogs
          ];

          # libgit2 needs these
          shellHook = ''
            export LD_LIBRARY_PATH=${pkgs.libkrb5}/lib:${pkgs.e2fsprogs.out}/lib
          '';
        };
      });
}
