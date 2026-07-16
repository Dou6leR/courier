"""Create an admin user.

Usage:
    uv run python -m actions.create_admin \
        --full-name "Admin Name" \
        --phone "+380000000000" \
        --email admin@example.com \
        --password "strong-password"
"""

import argparse
import asyncio

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth.password import hash_password
from core.helpers.db_helper import db_helper
from core.models.admin import Admin
from core.models.user import User


async def create_admin(
    session: AsyncSession,
    full_name: str,
    phone: str,
    email: str,
    password: str,
) -> User:
    existing = await session.scalar(select(User).where(User.email == email))
    if existing is not None:
        is_already_admin = await session.scalar(
            select(Admin.user_id).where(Admin.user_id == existing.id)
        )
        if is_already_admin:
            raise SystemExit(f"User {email} is already an admin (id={existing.id})")
        session.add(Admin(user_id=existing.id))
        await session.commit()
        print(f"Promoted existing user {email} (id={existing.id}) to admin")
        return existing

    user = User(
        full_name=full_name,
        phone=phone,
        email=email,
        password_hash=hash_password(password),
    )
    session.add(user)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise SystemExit(f"Failed to create user: {exc.orig}") from exc
    session.add(Admin(user_id=user.id))
    await session.commit()
    print(f"Created admin {email} (id={user.id})")
    return user


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create an admin user")
    parser.add_argument("--full-name", required=True)
    parser.add_argument("--phone", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    try:
        async with db_helper.session_factory() as session:
            await create_admin(
                session,
                full_name=args.full_name,
                phone=args.phone,
                email=args.email,
                password=args.password,
            )
    finally:
        await db_helper.dispose()


if __name__ == "__main__":
    asyncio.run(main())
