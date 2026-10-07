<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Student profiles are private authenticated views of the current user's existing profile, lesson progress, and derived badges; this avoids adding social networking or exposing student information.
- Store avatar files in the private avatars bucket under the owner's UUID and persist only their path in profiles; signed URLs keep access aligned with school assignments and roles.
