{
  description = "linea-monorepo";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    treefmt-nix = {
      url = "github:numtide/treefmt-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    gitignore = {
      url = "github:hercules-ci/gitignore.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    flake-compat.url = "github:edolstra/flake-compat/v1.0.1";
    systems.url = "github:nix-systems/default";
    flake-utils = {
      url = "github:numtide/flake-utils";
      inputs.systems.follows = "systems";
    };
    pre-commit-hooks = {
      url = "github:cachix/pre-commit-hooks.nix";
      inputs = {
        nixpkgs.follows = "nixpkgs";
        nixpkgs-stable.follows = "nixpkgs";
        flake-compat.follows = "flake-compat";
        gitignore.follows = "gitignore";
      };
    };
    devenv = {
      url = "github:cachix/devenv/latest";
      inputs = {
        nixpkgs.follows = "nixpkgs";
        flake-compat.follows = "flake-compat";
        pre-commit-hooks.follows = "pre-commit-hooks";
        cachix.follows = "";
        nix.follows = "";
      };
    };
    flake-parts = {
      url = "github:hercules-ci/flake-parts";
      inputs.nixpkgs-lib.follows = "nixpkgs";
    };
  };
  outputs = inputs @ {
    flake-parts,
    treefmt-nix,
    devenv,
    ...
  }:
    flake-parts.lib.mkFlake {inherit inputs;} {
      imports = [
        treefmt-nix.flakeModule
        devenv.flakeModule
      ];
      systems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-darwin"
        "x86_64-linux"
      ];
      perSystem = {config, pkgs, ...}: {
        treefmt = {
          projectRootFile = "flake.nix";
        };
        devenv.shells.default = {
          name = "linea-monorepo";
          packages = [pkgs.docker-compose];
          languages = {
            nix.enable = true;
            javascript = {
              enable = true;
              package = pkgs.nodejs_22;
              npm.enable = true;
              pnpm = {
                enable = true;
                install.enable = true;
              };
            };
            go.enable = true;
          };
          pre-commit.hooks = {
            nil.enable = true;
            statix.enable = true;
            deadnix.enable = true;
            treefmt = {
              enable = true;
              package = config.treefmt.build.wrapper;
            };
          };
        };
      };
    };
}
